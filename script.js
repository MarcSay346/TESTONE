
//page switch
function showPage(pageId){
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");
}

// check in
function checkIn(button, status){
  const card = button.closest(".card");
  const statusText = card.querySelector(".status");

  statusText.textContent = "Status: " + status;
  statusText.style.color =
    status === "Attended" ? "green" : "#C8102E";
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
function copyInvite(){
  navigator.clipboard.writeText("blahblahblah")
    .then(() => alert("Invite code copied!"))
    .catch(() => alert("Invite code: blahblahblah"));
}
