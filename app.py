import os, ssl
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
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.dbapi.connect(user=u.username, password=u.password, host=u.hostname,
                                port=u.port, database=u.path.lstrip("/"), ssl_context=ctx)

def rows(cur):
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]

@app.route("/")
def home():
    return send_from_directory(".", "alex.html")

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
    except Exception as e:
        conn.rollback()
        return jsonify(message="Username or email already taken"), 400
    finally:
        conn.close()

@app.route("/api/login", methods=["POST"])
def login():
    d = request.get_json()
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, password_hash FROM accounts WHERE username = %s", (d["username"],))
    row = cur.fetchone(); conn.close()
    if row and check_password_hash(row[1], d["password"]):
        return jsonify(message="Logged in", id=row[0])
    return jsonify(message="Wrong username or password"), 401

# ---------- GROUPS ----------
@app.route("/api/accounts/<int:account_id>/groups")
def my_groups(account_id):
    conn = db(); cur = conn.cursor()
    cur.execute("""SELECT g.id, g.group_name FROM group_members gm
                   JOIN friend_groups g ON g.id = gm.group_id
                   WHERE gm.account_id = %s""", (account_id,))
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
    conn = db(); cur = conn.cursor()
    cur.execute("""SELECT f.id, a.username, f.image_url, f.average_rating, f.total_ratings
                   FROM fit_checks f JOIN accounts a ON a.id = f.account_id
                   ORDER BY f.posted_at DESC""")
    data = rows(cur); conn.close()
    return jsonify(data)

if __name__ == "__main__":
    app.run(debug=True)