//page switch
function showPage(pageId){
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");

    // remove the highlight 
    document.querySelectorAll(".sidebar nav button").forEach(button => {
        button.classList.remove("active");
    });

    // highlight the button 
    const activeButton = document.querySelector(
        `.sidebar nav button[onclick="showPage('${pageId}')"]`
    );

    if (activeButton){
        activeButton.classList.add("active");
    }

  });

  document.getElementById(pageId).classList.remove("hidden");
}

// check in

 // check in
function checkIn(button, status){
    const card = button.closest(".card");
    const statusText = card.querySelector(".status");

    statusText.textContent = "Status: " + status;
    statusText.style.color =
        status === "Attended" ? "green" : "#C8102E";

    if (status === "Attended"){
        const className = card.querySelector("h3").textContent;

        addActivity(
            "class",
            "You",
            "checked into " + className + "."
        );
    }
}


// preeevvv
const upload = document.getElementById("outfitUpload");
const preview = document.getElementById("preview");

upload.addEventListener("change", function(){
    const file = upload.files[0];

  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  }
});

// add fit to da feed 
function postOutfit(){
  const file = upload.files[0];

  if (!file){
    alert("Please choose an outfit photo first!");
    return;
  }

  const visibility =
    document.getElementById("visibility").value;

  const feed = document.getElementById("outfitFeed");

  const card = document.createElement("div");
  card.className = "card";

  const image = document.createElement("img");
  image.src = URL.createObjectURL(file);
  image.className = "outfit-photo";
  image.alt = "Uploaded outfit";

  const label = document.createElement("p");
  label.textContent = "Visibility: " + visibility;

  card.appendChild(image);
  card.appendChild(label);
  feed.prepend(card);

  upload.value = "";
  preview.hidden = true;

  alert("Outfit added to your demo feed!");
}

// copy da code

 // this is random code generator 
function generateInviteCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "COOG-";

    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(
            Math.random() * characters.length
        );

        code += characters[randomIndex];
    }

    return code;
}

// check for a code
let inviteCode = localStorage.getItem("circleInviteCode");

// only if it doesnt exist
if (!inviteCode) {
    inviteCode = generateInviteCode();
    localStorage.setItem("circleInviteCode", inviteCode);
}

// show on website
document.getElementById("inviteCode").textContent = inviteCode;

function copyInvite() {
    navigator.clipboard.writeText(inviteCode)
        .then(() => alert("Invite code copied!"))
        .catch(() => alert("Invite code: " + inviteCode));
}

// generate the actuactualzl code
const qrContainer = document.getElementById("inviteQR");

if (qrContainer && typeof QRCode !== "undefined") {
    new QRCode(qrContainer, {
        text: inviteCode,
        width: 180,
        height: 180,
        colorDark: "#C8102E",
        colorLight: "#ffffff"
    });
}



// auto feed

const activityPosts = JSON.parse(
    localStorage.getItem("coogsceneActivity") || "[]"
);

function addActivity(type, name, description, image = null) {
    activityPosts.unshift({
        type: type,
        name: name,
        description: description,
        image: image,
        time: new Date().toLocaleString()
    });

    // only last 30
    if (activityPosts.length > 30) {
        activityPosts.length = 30;
    }

    localStorage.setItem(
        "coogsceneActivity",
        JSON.stringify(activityPosts)
    );

    renderCampusFeed();
}


function renderCampusFeed() {
    const feed = document.getElementById("campusFeed");
    if (!feed) return;

    const clearBtn = document.getElementById("clearActivityBtn");

    if (clearBtn) {
        clearBtn.hidden = activityPosts.length === 0;
    }

    feed.innerHTML = "";

    if (activityPosts.length === 0) {
        feed.textContent = "No recent activity yet.";
        return;
    }

    activityPosts.forEach(post => {
        const item = document.createElement("div");
        item.className = "activity-item";

        const icon = document.createElement("div");
        icon.className = "activity-icon";

        if (post.type === "class") {
            icon.textContent = "📅";
        } else if (post.type === "fit") {
            icon.textContent = "👕";
        } else {
            icon.textContent = "👥";
        }

        const details = document.createElement("div");
        details.className = "activity-details";

        const description = document.createElement("p");
        description.textContent =
            post.name + " " + post.description;

        const time = document.createElement("small");
        time.textContent = post.time;

        details.append(description, time);

        if (post.image) {
            const photo = document.createElement("img");
            photo.src = post.image;
            photo.className = "activity-photo";
            photo.alt = "Fit Check";
            details.appendChild(photo);
        }

        item.append(icon, details);
        feed.appendChild(item);
    });
}

function clearActivity() {
    if (confirm("Are you sure you want to clear all activity?")) {
        localStorage.removeItem("coogsceneActivity");
        activityPosts.length = 0;
        renderCampusFeed();
    }
}

// saved when loaded
renderCampusFeed();
