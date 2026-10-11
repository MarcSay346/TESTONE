import os, ssl
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import pg8000.dbapi

load_dotenv()
app = Flask(__name__, static_folder=".", static_url_path="")


def db():
    u = urlparse(os.getenv("DATABASE_URL"))
    ctx = ssl.create_default_context()
    ctx.check_hostname = False          # still encrypted; matches sslmode=require
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.dbapi.connect(user=u.username, password=u.password, host=u.hostname,
                                port=u.port, database=u.path.lstrip("/"), ssl_context=ctx)


def fix_time(key, value):
    # class_time is what the user typed (local time): send it as-is, e.g. "2026-10-13T08:30:00".
    # every other timestamp (posted_at, updated_at, ...) is stored in UTC: mark it with "Z".
    if isinstance(value, datetime):
        return value.isoformat() if key == "class_time" else value.isoformat() + "Z"
    return value


def rows(cur):
    cols = [c[0] for c in cur.description]
    return [{k: fix_time(k, v) for k, v in zip(cols, r)} for r in cur.fetchall()]


@app.route("/")
def home():
    return send_from_directory(".", "login.html")


# ---------- ACCOUNTS ----------
@app.route("/api/accounts")
def list_accounts():
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, username, email, university_name, created_at FROM accounts")
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/signup", methods=["POST"])
def signup():
    d = request.get_json()
    conn = db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO accounts (username, email, password_hash, university_name) "
            "VALUES (%s, %s, %s, %s) RETURNING id",
            (d["username"], d["email"], generate_password_hash(d["password"]), d["university_name"]))
        new_id = cur.fetchone()[0]
        conn.commit()
        return jsonify(message="Account created", id=new_id)
    except Exception:
        conn.rollback()
        return jsonify(message="Username or email already taken"), 400
    finally:
        conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    d = request.get_json()
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, password_hash, is_admin FROM accounts "
                "WHERE username = %s OR email = %s", (d["username"], d["username"]))
    row = cur.fetchone(); conn.close()
    if row and check_password_hash(row[1], d["password"]):
        return jsonify(message="Logged in", id=row[0], is_admin=bool(row[2]))
    return jsonify(message="Wrong username or password"), 401


# ---------- GROUPS / CIRCLE ----------
@app.route("/api/accounts/<int:account_id>/groups")
def my_groups(account_id):
    conn = db(); cur = conn.cursor()
    cur.execute("""SELECT g.id, g.group_name FROM group_members gm
                   JOIN friend_groups g ON g.id = gm.group_id
                   WHERE gm.account_id = %s""", (account_id,))
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/accounts/<int:account_id>/circle")
def my_circle(account_id):
    conn = db(); cur = conn.cursor()
    # everyone in my circles + their most recent check-in
    cur.execute("""
        SELECT a.id, a.username, ls.status, ls.class_name, ls.updated_at
        FROM accounts a
        JOIN (SELECT DISTINCT gm.account_id
              FROM group_members me
              JOIN group_members gm ON gm.group_id = me.group_id
              WHERE me.account_id = %s) c ON c.account_id = a.id
        LEFT JOIN LATERAL (
              SELECT s.status, s.class_name, s.updated_at
              FROM schedules s
              WHERE s.account_id = a.id
              ORDER BY s.updated_at DESC LIMIT 1) ls ON TRUE
        ORDER BY a.username
    """, (account_id,))
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/accounts/<int:account_id>/circle/schedules")
def circle_schedules(account_id):
    # every schedule item from everyone in my circles (and me), for the circle calendar
    conn = db(); cur = conn.cursor()
    cur.execute("""
        SELECT s.id, s.class_name, s.class_time, s.status, a.id AS account_id, a.username
        FROM schedules s
        JOIN accounts a ON a.id = s.account_id
        WHERE s.account_id = %s
           OR s.account_id IN (SELECT gm.account_id
                               FROM group_members me
                               JOIN group_members gm ON gm.group_id = me.group_id
                               WHERE me.account_id = %s)
        ORDER BY s.class_time
    """, (account_id, account_id))
    data = rows(cur); conn.close()
    return jsonify(data)


# ---------- SCHEDULES ----------
@app.route("/api/accounts/<int:account_id>/schedules")
def my_schedule(account_id):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, class_name, class_time, status FROM schedules "
                "WHERE account_id = %s ORDER BY class_time", (account_id,))
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/accounts/<int:account_id>/schedules", methods=["POST"])
def add_schedule(account_id):
    d = request.get_json()
    name = (d.get("class_name") or "").strip()[:100]
    when = d.get("class_time")                     # e.g. "2026-10-13T10:00"
    if not name or not when:
        return jsonify(message="Add a name and a date/time."), 400
    conn = db(); cur = conn.cursor()
    cur.execute("INSERT INTO schedules (account_id, class_name, class_time) "
                "VALUES (%s, %s, %s) RETURNING id", (account_id, name, when))
    new_id = cur.fetchone()[0]
    conn.commit(); conn.close()
    return jsonify(message="Added to your schedule!", id=new_id)


@app.route("/api/schedules/<int:sid>", methods=["DELETE"])
def delete_schedule(sid):
    acct = request.args.get("account_id", type=int)
    conn = db(); cur = conn.cursor()
    # only the owner can remove their own item
    cur.execute("DELETE FROM schedules WHERE id = %s AND account_id = %s", (sid, acct))
    conn.commit(); conn.close()
    return jsonify(message="Removed")


@app.route("/api/schedules/<int:sid>/status", methods=["POST"])
def update_status(sid):
    status = request.get_json()["status"]   # checked_in / skipped / pending
    conn = db(); cur = conn.cursor()
    cur.execute("UPDATE schedules SET status = %s, updated_at = NOW() WHERE id = %s", (status, sid))
    conn.commit(); conn.close()
    return jsonify(message="Updated")


# ---------- FIT CHECKS ----------
@app.route("/api/fitchecks")
def fit_checks():
    feed = request.args.get("feed", "public")          # public = Campus Hub, friends = Close Friends
    acct = request.args.get("account_id", type=int) or 0
    # my_rating = the score (1-10) the viewer gave this fit; has_reported = viewer already flagged it
    cols = """f.id, f.account_id, a.username, f.image_url, f.caption, f.visibility, f.posted_at,
              f.average_rating::float AS average_rating, f.total_ratings,
              (SELECT r.stars FROM fit_ratings r
               WHERE r.fit_id = f.id AND r.account_id = %s) AS my_rating,
              EXISTS (SELECT 1 FROM reports rp
                      WHERE rp.fit_id = f.id AND rp.reporter_id = %s) AS has_reported"""
    conn = db(); cur = conn.cursor()
    if feed == "friends" and acct:
        # everything posted by people in my circles (and me)
        cur.execute(f"""SELECT {cols}
                        FROM fit_checks f JOIN accounts a ON a.id = f.account_id
                        WHERE f.account_id = %s
                           OR f.account_id IN (SELECT gm.account_id
                                               FROM group_members me
                                               JOIN group_members gm ON gm.group_id = me.group_id
                                               WHERE me.account_id = %s)
                        ORDER BY f.posted_at DESC""", (acct, acct, acct, acct))
    else:
        cur.execute(f"""SELECT {cols}
                        FROM fit_checks f JOIN accounts a ON a.id = f.account_id
                        WHERE COALESCE(f.visibility, 'public') = 'public'
                        ORDER BY f.posted_at DESC""", (acct, acct))
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/fitchecks", methods=["POST"])
def post_fit():
    d = request.get_json()
    image = d.get("image", "")
    if not image.startswith("data:image/") or len(image) > 3_000_000:
        return jsonify(message="Please choose a photo under ~2 MB."), 400
    visibility = "friends" if d.get("visibility") == "friends" else "public"
    caption = (d.get("caption") or "")[:150]
    conn = db(); cur = conn.cursor()
    cur.execute("INSERT INTO fit_checks (account_id, image_url, caption, visibility) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (d["account_id"], image, caption, visibility))
    new_id = cur.fetchone()[0]
    conn.commit(); conn.close()
    return jsonify(message="Fit posted!", id=new_id)


@app.route("/api/fitchecks/<int:fit_id>/rate", methods=["POST"])
def rate_fit(fit_id):
    d = request.get_json()
    acct = int(d["account_id"])
    stars = int(d["stars"])            # score from 1 to 10
    if not 1 <= stars <= 10:
        return jsonify(message="Rating must be from 1 to 10."), 400

    conn = db(); cur = conn.cursor()
    cur.execute("SELECT account_id FROM fit_checks WHERE id = %s", (fit_id,))
    row = cur.fetchone()
    if not row:
        conn.close(); return jsonify(message="Fit not found."), 404
    if row[0] == acct:
        conn.close(); return jsonify(message="You can't rate your own fit."), 400

    # one rating per person per fit; rating again changes it
    cur.execute("""INSERT INTO fit_ratings (fit_id, account_id, stars) VALUES (%s, %s, %s)
                   ON CONFLICT (fit_id, account_id)
                   DO UPDATE SET stars = EXCLUDED.stars, rated_at = NOW()""",
                (fit_id, acct, stars))
    # keep the fit's average + count up to date
    cur.execute("""UPDATE fit_checks SET
                     average_rating = (SELECT ROUND(AVG(stars), 2) FROM fit_ratings WHERE fit_id = %s),
                     total_ratings  = (SELECT COUNT(*)             FROM fit_ratings WHERE fit_id = %s)
                   WHERE id = %s
                   RETURNING average_rating::float, total_ratings""",
                (fit_id, fit_id, fit_id))
    avg, total = cur.fetchone()
    conn.commit(); conn.close()
    return jsonify(message="Thanks for rating!", average_rating=avg, total_ratings=total, my_rating=stars)


# ---------- REPORTS (users flag posts) ----------
@app.route("/api/reports", methods=["POST"])
def create_report():
    d = request.get_json()
    reporter = int(d["reporter_id"])
    fit_id = int(d["fit_id"])
    reason = (d.get("reason") or "").strip()[:200]
    if not reason:
        return jsonify(message="Please pick a reason."), 400

    conn = db(); cur = conn.cursor()
    cur.execute("SELECT account_id FROM fit_checks WHERE id = %s", (fit_id,))
    row = cur.fetchone()
    if not row:
        conn.close(); return jsonify(message="Fit not found."), 404
    if row[0] == reporter:
        conn.close(); return jsonify(message="You can't report your own fit."), 400

    # one report per person per fit
    cur.execute("SELECT 1 FROM reports WHERE reporter_id = %s AND fit_id = %s", (reporter, fit_id))
    if cur.fetchone():
        conn.close(); return jsonify(message="You already reported this fit."), 400

    cur.execute("INSERT INTO reports (reporter_id, fit_id, reason) VALUES (%s, %s, %s)",
                (reporter, fit_id, reason))
    conn.commit(); conn.close()
    return jsonify(message="Thanks, an admin will review this post.")


# ---------- ADMIN ----------
def is_admin():
    acct = request.headers.get("X-Account-Id")
    if not acct or not acct.isdigit():
        return False
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT is_admin FROM accounts WHERE id = %s", (int(acct),))
    row = cur.fetchone(); conn.close()
    return bool(row and row[0])


@app.route("/api/admin/stats")
def admin_stats():
    if not is_admin(): return jsonify(message="Admins only"), 403
    conn = db(); cur = conn.cursor()
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM accounts)                              AS users,
          (SELECT COUNT(*) FROM friend_groups)                         AS circles,
          (SELECT COUNT(*) FROM schedules WHERE status <> 'pending')   AS checkins,
          (SELECT COUNT(*) FROM reports   WHERE status = 'open')       AS reports
    """)
    data = rows(cur)[0]; conn.close()
    return jsonify(data)


@app.route("/api/admin/reports")
def admin_reports():
    if not is_admin(): return jsonify(message="Admins only"), 403
    conn = db(); cur = conn.cursor()
    cur.execute("""
        SELECT r.id, r.reason, r.created_at, r.fit_id,
               f.image_url, poster.username AS posted_by, reporter.username AS reported_by
        FROM reports r
        JOIN fit_checks f      ON f.id = r.fit_id
        JOIN accounts poster   ON poster.id = f.account_id
        JOIN accounts reporter ON reporter.id = r.reporter_id
        WHERE r.status = 'open'
        ORDER BY r.created_at DESC
    """)
    data = rows(cur); conn.close()
    return jsonify(data)


@app.route("/api/admin/reports/<int:rid>/dismiss", methods=["POST"])
def dismiss_report(rid):
    if not is_admin(): return jsonify(message="Admins only"), 403
    conn = db(); cur = conn.cursor()
    cur.execute("UPDATE reports SET status = 'dismissed' WHERE id = %s", (rid,))
    conn.commit(); conn.close()
    return jsonify(message="Dismissed")


@app.route("/api/admin/fits/<int:fit_id>", methods=["DELETE"])
def admin_delete_fit(fit_id):
    if not is_admin(): return jsonify(message="Admins only"), 403
    conn = db(); cur = conn.cursor()
    cur.execute("DELETE FROM fit_checks WHERE id = %s", (fit_id,))   # its reports cascade away
    conn.commit(); conn.close()
    return jsonify(message="Removed")


if __name__ == "__main__":
    app.run(debug=True)