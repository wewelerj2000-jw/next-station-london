// --- 1. FIREBASE SETUP (DEINE ZUGANGSDATEN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxU5ARhZgfXCDrL1NgBNCANeuTrZWyLhI",
  authDomain: "london-u-bahn.firebaseapp.com",
  databaseURL: "https://london-u-bahn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "london-u-bahn",
  storageBucket: "london-u-bahn.firebasestorage.app",
  messagingSenderId: "701503607235",
  appId: "1:701503607235:web:932d5b78a4ef1575e1ed76",
  measurementId: "G-XCBVPHNDZ7"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


// --- 2. KARTENDECK & SYNCHRONISATION ---
const allCards = [
  // Oberirdische Karten (Blau)
  { name: "Quadrat", type: "oberirdisch", image: "karte_quadrat_blau.png" },
  { name: "Dreieck", type: "oberirdisch", image: "karte_dreieck_blau.png" },
  { name: "Fünfeck", type: "oberirdisch", image: "karte_fuenfeck_blau.png" },
  { name: "Kreis", type: "oberirdisch", image: "karte_kreis_blau.png" },
  { name: "Joker (Beliebiges Symbol)", type: "oberirdisch", image: "karte_joker_blau.png" },
  { name: "Weiche / Abzweigung", type: "oberirdisch", image: "karte_weiche_blau.png" },
  
  // Unterirdische Karten (Rosa/Gelb)
  { name: "Quadrat", type: "unterirdisch", image: "karte_quadrat_rosa.png" },
  { name: "Dreieck", type: "unterirdisch", image: "karte_dreieck_rosa.png" },
  { name: "Fünfeck", type: "unterirdisch", image: "karte_fuenfeck_rosa.png" },
  { name: "Kreis", type: "unterirdisch", image: "karte_kreis_rosa.png" },
  { name: "Joker (Beliebiges Symbol)", type: "unterirdisch", image: "karte_joker_rosa.png" }
];

let drawPile = [];
let undergroundDrawnCount = 0;

function shuffleDeck() {
  drawPile = [...allCards];
  for (let i = drawPile.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [drawPile[i], drawPile[j]] = [drawPile[j], drawPile[i]];
  }
  undergroundDrawnCount = 0;
  
  // In Firebase zurücksetzen
  set(ref(database, 'game/state'), {
    cardName: "Stapel gemischt! Klicke 'Karte ziehen'",
    cardType: "neutral",
    cardImage: "",
    undergroundCount: 0,
    remainingCount: 11,
    timestamp: Date.now()
  });
}

function drawCard() {
  if (drawPile.length === 0) {
    alert("Keine Karten mehr im Stapel!");
    return;
  }

  const card = drawPile.pop();
  if (card.type === "unterirdisch") {
    undergroundDrawnCount++;
  }

  // Karte in Firebase speichern (sendet sie live an beide Spieler!)
  set(ref(database, 'game/state'), {
    cardName: card.name,
    cardType: card.type,
    cardImage: card.image,
    undergroundCount: undergroundDrawnCount,
    remainingCount: drawPile.length,
    timestamp: Date.now()
  });
}

// Live-Empfang von Firebase (reagiert bei BEIDEN Spielern sofort)
onValue(ref(database, 'game/state'), (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const cardDisplay = document.getElementById("cardDisplay");
  const statusMsg = document.getElementById("statusMessage");

  if (data.cardType === "neutral") {
    cardDisplay.innerHTML = `<div class="card-placeholder">${data.cardName}</div>`;
    statusMsg.style.display = "none";
    document.getElementById("drawCardBtn").disabled = false;
  } else {
    cardDisplay.innerHTML = `
      <div class="card ${data.cardType}">
        <img src="${data.cardImage}" alt="${data.cardName}" onerror="this.style.display='none';" style="max-height: 110px; max-width: 100%; object-fit: contain; margin-bottom: 5px;">
        <div class="card-title" style="font-size: 1.1rem;">${data.cardName}</div>
        <div class="card-type">${data.cardType === "unterirdisch" ? "Unterirdische Karte" : "Oberirdische Karte"}</div>
      </div>
    `;
  }

  document.getElementById("undergroundCount").innerText = data.undergroundCount;
  document.getElementById("remainingCount").innerText = data.remainingCount;

  if (data.undergroundCount === 5) {
    statusMsg.innerText = "⚠️ 5. unterirdische Karte gezogen! Dieser Durchgang endet jetzt.";
    statusMsg.className = "status-msg warning";
    statusMsg.style.display = "block";
    document.getElementById("drawCardBtn").disabled = true;
  }
});


// --- 3. ZEICHENFUNKTION (CANVAS) ---
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const boardImage = document.getElementById("boardImage");

let isDrawing = false;
let currentColor = "#0055A5";
let strokeWidth = 2.5;

function resizeCanvas() {
  canvas.width = boardImage.naturalWidth || boardImage.clientWidth;
  canvas.height = boardImage.naturalHeight || boardImage.clientHeight;
}

boardImage.onload = resizeCanvas;
window.onresize = resizeCanvas;
if (boardImage.complete) resizeCanvas();

function getCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX = e.clientX;
  let clientY = e.clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  isDrawing = true;
  const coords = getCoordinates(e);
  ctx.beginPath();
  ctx.moveTo(coords.x, coords.y);
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const coords = getCoordinates(e);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    ctx.closePath();
    isDrawing = false;
  }
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchmove", draw);
canvas.addEventListener("touchend", stopDrawing);

document.querySelectorAll(".color-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentColor = e.target.getAttribute("data-color");
  });
});

document.getElementById("clearCanvasBtn").addEventListener("click", () => {
  if (confirm("Möchtest du wirklich alle eingezeichneten Linien löschen?")) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});

document.getElementById("drawCardBtn").addEventListener("click", drawCard);
document.getElementById("newRoundBtn").addEventListener("click", shuffleDeck);

shuffleDeck();


// --- 4. WERTUNGSBOGEN BERECHNUNG ---
function calculateLineScore(districtsId, maxStationsId, riverId, totalElementId) {
  const districts = parseInt(document.getElementById(districtsId).value) || 0;
  const maxStations = parseInt(document.getElementById(maxStationsId).value) || 0;
  const river = parseInt(document.getElementById(riverId).value) || 0;

  const lineTotal = (districts * maxStations) + river;
  document.getElementById(totalElementId).innerText = lineTotal;
  return lineTotal;
}

function calculateGrandTotal() {
  const blue = calculateLineScore("blueDistricts", "blueMaxStations", "blueRiver", "blueTotal");
  const pink = calculateLineScore("pinkDistricts", "pinkMaxStations", "pinkRiver", "pinkTotal");
  const green = calculateLineScore("greenDistricts", "greenMaxStations", "greenRiver", "greenTotal");
  const purple = calculateLineScore("purpleDistricts", "purpleMaxStations", "purpleRiver", "purpleTotal");

  const attractions = parseInt(document.getElementById("attractionsBonus").value) || 0;
  const interchange = parseInt(document.getElementById("interchangeBonus").value) || 0;

  const grandTotal = blue + pink + green + purple + attractions + interchange;
  document.getElementById("finalScore").innerText = grandTotal;
}

document.querySelectorAll(".score-input").forEach(input => {
  input.addEventListener("input", calculateGrandTotal);
});