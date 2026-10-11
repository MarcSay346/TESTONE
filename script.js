const me = localStorage.getItem("accountId");
const myName = localStorage.getItem("username") || "";

// ---------- helpers ----------
const LABEL = { checked_in: "Checked In", skipped: "Missed", pending: "Not Checked In" };
const PILL  = { checked_in: "free",       skipped: "busy",   pending: "away" };

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function fmtDay(t) {
  return new Date(t).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" });
}

function timeAgo(t) {
  const mins = Math.round((Date.now() - new Date(t)) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

function icons() {
  if (window.lucide) lucide.createIcons();
}

// ---------- navigation ----------
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll("nav button").forEach(b =>
    b.classList.toggle("active", b.getAttribute("onclick").includes(`'${id}'`)));
}

function logout() {
  localStorage.clear();
  sessionStorage.clear();
  location.href = "/login.html";
}

// ---------- home + circle ----------
async function loadCircle() {
  const people = await (await fetch(`/api/accounts/${me}/circle`)).json();
  const friends = people.filter(p => String(p.id) !== String(me));

  // What's Happening?
  document.getElementById("friendsStatus").innerHTML = friends.length
    ? friends.map(p => `
        <div class="friend-box">
          <div class="friend-avatar">${initials(p.username)}</div>
          <div class="friend-info">
            <strong>${p.username}</strong>
            <span>${p.class_name || "No classes yet"}</span>
          </div>
          <span class="status ${PILL[p.status] || "away"}">${LABEL[p.status] || "Not Checked In"}</span>
        </div>`).join("")
    : `<p class="feed-empty">No one in your circle yet.</p>`;

  // Circle Activity (only real check-ins, newer than "clear")
  const clearedAt = Number(localStorage.getItem("activityClearedAt") || 0);
  const activity = friends
    .filter(p => p.status && p.status !== "pending" && new Date(p.updated_at) > clearedAt)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  document.getElementById("campusFeed").innerHTML = activity.length
    ? activity.map(p => `
        <div class="feed-item">
          <div class="friend-avatar">${initials(p.username)}</div>
          <span><b>${p.username}</b> ${p.status === "checked_in" ? "checked in to" : "missed"} <b>${p.class_name}</b></span>
          <span class="feed-time">${timeAgo(p.updated_at)}</span>
        </div>`).join("")
    : `<p class="feed-empty">No recent activity yet.</p>`;
  document.getElementById("clearActivityBtn").hidden = activity.length === 0;

  // Circle page members
  document.getElementById("memberCount").textContent =
    people.length + (people.length === 1 ? " member" : " members");
  document.getElementById("circleMembers").innerHTML = people.length
    ? people.map(p => `
        <div class="member-row">
          <div class="member-avatar">${initials(p.username)}</div>
          <div class="member-info">
            <h4>${p.username}${String(p.id) === String(me) ? " (you)" : ""}</h4>
            <p>${p.class_name || "No classes yet"}</p>
          </div>
          <span class="member-status ${p.status === "checked_in" ? "in-class" : p.status === "skipped" ? "available" : "away"}">
            ${p.status === "checked_in" ? "In Class" : p.status === "skipped" ? "Free Now" : "Not Checked In"}
          </span>
        </div>`).join("")
    : `<p class="feed-empty">No members yet.</p>`;
}

function clearActivity() {
  localStorage.setItem("activityClearedAt", Date.now());
  loadCircle();
}

// ---------- schedule ----------
async function loadSchedule() {
  const classes = await (await fetch(`/api/accounts/${me}/schedules`)).json();

  // home: next few classes
  document.getElementById("plansList").innerHTML = classes.length
    ? classes.slice(0, 4).map(c => `
        <div class="plan-box">
          <div class="plan-icon">📅</div>
          <div class="plan-info">
            <strong>${c.class_name}</strong>
            <span>${fmtDay(c.class_time)}</span>
          </div>
          <span class="status ${PILL[c.status]}">${LABEL[c.status]}</span>
        </div>`).join("")
    : `<p class="feed-empty">No classes yet.</p>`;

  // schedule page
  document.getElementById("scheduleList").innerHTML = classes.length
    ? classes.map(c => `
        <div class="card schedule-card">
          <div class="schedule-top">
            <div class="schedule-icon"><i data-lucide="book-open"></i></div>
            <div class="schedule-info">
              <h3>${c.class_name}</h3>
              <p>${fmtDay(c.class_time)}</p>
            </div>
            <span class="status schedule-status ${PILL[c.status]}">${LABEL[c.status]}</span>
          </div>
          <div class="schedule-actions">
            <button onclick="checkIn(${c.id}, 'checked_in')">Attend</button>
            <button class="missed-btn" onclick="checkIn(${c.id}, 'skipped')">Missed</button>
            <button class="missed-btn remove-btn" onclick="removeSchedule(${c.id})">Remove</button>
          </div>
        </div>`).join("")
    : `<div class="card"><p class="feed-empty">No classes yet.</p></div>`;

  icons();
}

// add a class or plan
document.getElementById("addScheduleForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("schedMsg");
  const res = await fetch(`/api/accounts/${me}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      class_name: document.getElementById("schedName").value,
      class_time: document.getElementById("schedTime").value
    })
  });
  msg.textContent = (await res.json()).message;
  if (res.ok) {
    e.target.reset();
    loadSchedule();
    loadCircle();
  }
});

async function removeSchedule(scheduleId) {
  if (!confirm("Remove this from your schedule?")) return;
  await fetch(`/api/schedules/${scheduleId}?account_id=${me}`, { method: "DELETE" });
  loadSchedule();
  loadCircle();
}

async function checkIn(scheduleId, status) {
  await fetch(`/api/schedules/${scheduleId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  loadSchedule();
  loadCircle();
  loadCalendar();
}

// ---------- fit check ----------
let currentFeed = "public";   // "public" = Campus Hub, "friends" = Close Friends

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadFits() {
  const fits = await (await fetch(`/api/fitchecks?feed=${currentFeed}&account_id=${me}`)).json();
  // empty string lets the CSS "No outfits posted yet" message show
  document.getElementById("outfitFeed").innerHTML = fits.map(f => `
    <div class="feed-post">
      <div class="feed-user">
        <div class="feed-avatar">${initials(f.username)}</div>
        <div>
          <strong>@${escapeHtml(f.username)}</strong>
          <span class="feed-time">${timeAgo(f.posted_at)} · ${f.visibility === "friends" ? "Close Friends" : "Campus Hub"}</span>
        </div>
      </div>
      ${f.caption ? `<p>${escapeHtml(f.caption)}</p>` : ""}
      <img src="${f.image_url}" class="feed-photo" alt="Outfit by ${escapeHtml(f.username)}">
      ${ratingHtml(f)}
      ${reportHtml(f)}
    </div>`).join("");
}

// ---------- ratings (1-10) ----------
function avgText(f) {
  const total = Number(f.total_ratings) || 0;
  return total
    ? `<b>${Number(f.average_rating).toFixed(1)}/10</b> avg · ${total} rating${total === 1 ? "" : "s"}`
    : "No ratings yet";
}

function ratingHtml(f) {
  // your own post: just show how it's doing
  if (String(f.account_id) === String(me)) {
    return `<div class="rating"><span class="rating-avg own">⭐ ${avgText(f)} on your fit</span></div>`;
  }

  const mine = Number(f.my_rating) || 0;
  let buttons = "";
  for (let i = 1; i <= 10; i++) {
    buttons += `<button type="button" class="score ${i === mine ? "on" : ""}"
                  onclick="rateFit(${f.id}, ${i})" aria-label="Rate ${i} out of 10">${i}</button>`;
  }
  return `
    <div class="rating">
      <span class="rating-label">${mine ? `You rated <b>${mine}/10</b>` : "Rate this fit:"}</span>
      <div class="score-row">${buttons}</div>
      <span class="rating-avg">${avgText(f)}</span>
    </div>`;
}

async function rateFit(fitId, score) {
  const res = await fetch(`/api/fitchecks/${fitId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: me, stars: score })
  });
  if (!res.ok) { alert((await res.json()).message); return; }
  loadFits();   // refresh so the new average shows
}

// ---------- reports ----------
const REPORT_REASONS = [
  "Inappropriate photo",
  "Harassment or bullying",
  "Spam",
  "Not an outfit",
  "Other"
];

function reportHtml(f) {
  if (String(f.account_id) === String(me)) return "";          // can't report yourself
  if (f.has_reported) {
    return `<button type="button" class="report-btn reported" disabled>Reported ✓</button>`;
  }
  return `
    <button type="button" class="report-btn" onclick="toggleReport(${f.id})">Report</button>
    <div class="report-box hidden" id="report-${f.id}">
      <select id="reason-${f.id}">
        ${REPORT_REASONS.map(r => `<option>${r}</option>`).join("")}
      </select>
      <button type="button" onclick="sendReport(${f.id})">Send Report</button>
      <button type="button" class="report-cancel" onclick="toggleReport(${f.id})">Cancel</button>
    </div>`;
}

function toggleReport(fitId) {
  document.getElementById(`report-${fitId}`).classList.toggle("hidden");
}

async function sendReport(fitId) {
  const reason = document.getElementById(`reason-${fitId}`).value;
  const res = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reporter_id: me, fit_id: fitId, reason })
  });
  alert((await res.json()).message);
  loadFits();   // button turns into "Reported ✓"
}

function switchFeed(feed) {
  currentFeed = feed;
  document.querySelectorAll("#fits .tab").forEach(t =>
    t.classList.toggle("active", t.dataset.feed === feed));
  loadFits();
}

document.querySelectorAll("#fits .tab").forEach(t =>
  t.addEventListener("click", () => switchFeed(t.dataset.feed)));

// shrink big phone photos so they upload fast and fit in the database
function resizeImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

document.getElementById("fitForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("fitMsg");
  const file = document.getElementById("outfitUpload").files[0];
  if (!file) { msg.textContent = "Choose a photo first."; return; }

  msg.textContent = "Posting...";
  const visibility = document.getElementById("visibility").value;
  const res = await fetch("/api/fitchecks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: me,
      image: await resizeImage(file),
      caption: document.getElementById("caption").value,
      visibility
    })
  });
  const data = await res.json();
  msg.textContent = data.message;

  if (res.ok) {
    e.target.reset();
    document.getElementById("preview").hidden = true;
    switchFeed(visibility);   // jump to the feed you posted in
  }
});


document.getElementById("outfitUpload")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = document.getElementById("preview");
  img.src = URL.createObjectURL(file);
  img.hidden = false;
});

// ---------- circle calendar (month view) ----------
const CAL_COLORS = ["#C8102E", "#2563EB", "#16A34A", "#9333EA", "#EA580C", "#0891B2", "#DB2777", "#65A30D"];
const CAL_MAX_MONTHS_AHEAD = 12;                 // can look up to a year ahead
const thisMonth = firstOfMonth(new Date());
let calMonth = new Date(thisMonth);
let calItems = [];

function firstOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function colorFor(accountId) {
  return CAL_COLORS[Number(accountId) % CAL_COLORS.length];
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function loadCalendar() {
  calItems = await (await fetch(`/api/accounts/${me}/circle/schedules`)).json();
  renderCalendar();
}

function moveMonth(n) {
  const next = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
  const ahead = monthsBetween(thisMonth, next);
  if (ahead < 0 || ahead > CAL_MAX_MONTHS_AHEAD) return;   // stay within this month .. 1 year out
  calMonth = next;
  renderCalendar();
}

function goToday() {
  calMonth = new Date(thisMonth);
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  const year = calMonth.getFullYear(), month = calMonth.getMonth();

  // title + arrows (greyed out at the limits)
  document.getElementById("calTitle").textContent =
    calMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const ahead = monthsBetween(thisMonth, calMonth);
  document.getElementById("calPrev").disabled = ahead <= 0;
  document.getElementById("calNext").disabled = ahead >= CAL_MAX_MONTHS_AHEAD;

  // color key
  const people = {};
  calItems.forEach(it => { people[it.account_id] = it.username; });
  document.getElementById("calLegend").innerHTML = Object.entries(people).map(([id, name]) => `
    <span class="cal-person"><span class="cal-dot" style="background:${colorFor(id)}"></span>
      ${escapeHtml(name)}${String(id) === String(me) ? " (you)" : ""}</span>`).join("");

  // weekday header row
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let html = names.map(n => `<div class="cal-head">${n}</div>`).join("");

  // start on the Sunday before the 1st, fill whole weeks through the end of the month
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - start.getDay());
  const last = new Date(year, month + 1, 0);
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - end.getDay()));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const items = calItems
      .filter(it => sameDay(new Date(it.class_time), d))
      .sort((a, b) => new Date(a.class_time) - new Date(b.class_time));

    const shown = items.slice(0, 3).map(it => {
      const t = new Date(it.class_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const mark = it.status === "checked_in" ? " ✓" : it.status === "skipped" ? " ✗" : "";
      return `
        <div class="cal-event" style="border-left-color:${colorFor(it.account_id)}"
             title="@${escapeHtml(it.username)}: ${escapeHtml(it.class_name)} at ${t}${mark}">
          <span class="cal-time">${t}</span> ${escapeHtml(it.class_name)}${mark}
        </div>`;
    }).join("");

    const more = items.length > 3
      ? `<div class="cal-more" title="${items.slice(3).map(it => "@" + escapeHtml(it.username) + ": " + escapeHtml(it.class_name)).join("&#10;")}">+${items.length - 3} more</div>`
      : "";

    const classes = ["cal-cell"];
    if (d.getMonth() !== month) classes.push("other-month");
    if (d.getDay() === 0 || d.getDay() === 6) classes.push("weekend");
    if (sameDay(d, today)) classes.push("today");

    html += `
      <div class="${classes.join(" ")}">
        <span class="cal-num">${d.getDate()}</span>
        ${shown}${more}
      </div>`;
  }

  document.getElementById("calGrid").innerHTML = html;
}

// ---------- invite ----------
const inviteCode = "COOG-" + me;

function copyInvite() {
  navigator.clipboard.writeText(inviteCode);
  alert("Invite code copied!");
}

function setupInvite() {
  document.getElementById("inviteCode").textContent = inviteCode;
  if (window.QRCode) {
    new QRCode(document.getElementById("inviteQR"), {
      text: location.origin + "/login.html?invite=" + inviteCode,
      width: 140,
      height: 140,
      colorDark: "#C8102E"
    });
  }
}

// ---------- start ----------
document.getElementById("topUser").textContent = myName ? "@" + myName : "";
document.getElementById("welcome").textContent = myName ? `Hey, ${myName}` : "Home";
icons();
// open a tab from the link, e.g. alex.html#fits from schedule.html
if (["home", "fits", "circle"].includes(location.hash.slice(1))) showPage(location.hash.slice(1));
setupInvite();
loadCircle();
loadSchedule();
loadFits();
loadCalendar();