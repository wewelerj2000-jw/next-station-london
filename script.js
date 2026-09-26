// --- 1. FIREBASE SETUP ---
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

// Rollenverwaltung
let myRole = "player1";
let opponentRole = "player2";

const roleSelect = document.getElementById("playerRoleSelect");
if (roleSelect) {
  roleSelect.addEventListener("change", (e) => {
    myRole = e.target.value;
    opponentRole = (myRole === "player1") ? "player2" : "player1";
    syncMyCanvasToFirebase();
    listenToOpponentCanvas();
  });
}


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
  
  const modeSelect = document.getElementById("gameModeSelect");
  const selectedMode = modeSelect ? modeSelect.value : "standard";

  set(ref(database, 'game/state'), {
    cardName: "Stapel gemischt! Klicke 'Karte ziehen'",
    cardType: "neutral",
    cardImage: "",
    undergroundCount: 0,
    remainingCount: 11,
    gameMode: selectedMode,
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

  const modeSelect = document.getElementById("gameModeSelect");
  const selectedMode = modeSelect ? modeSelect.value : "standard";

  set(ref(database, 'game/state'), {
    cardName: card.name,
    cardType: card.type,
    cardImage: card.image,
    undergroundCount: undergroundDrawnCount,
    remainingCount: drawPile.length,
    gameMode: selectedMode,
    timestamp: Date.now()
  });
}

onValue(ref(database, 'game/state'), (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const cardDisplay = document.getElementById("cardDisplay");
  const statusMsg = document.getElementById("statusMessage");
  const modeSelect = document.getElementById("gameModeSelect");

  if (modeSelect && data.gameMode) {
    modeSelect.value = data.gameMode;
  }

  if (data.cardType === "neutral") {
    cardDisplay.innerHTML = `<div class="card-placeholder">${data.cardName}</div>`;
    statusMsg.style.display = "none";
    const drawBtn = document.getElementById("drawCardBtn");
    if (drawBtn) drawBtn.disabled = false;
  } else {
    cardDisplay.innerHTML = `
      <div class="card ${data.cardType}">
        <img src="${data.cardImage}" alt="${data.cardName}" onerror="this.style.display='none';" style="max-height: 110px; max-width: 100%; object-fit: contain; margin-bottom: 5px;">
        <div class="card-title">${data.cardName}</div>
        <div class="card-type">${data.cardType === "unterirdisch" ? "Unterirdische Karte" : "Oberirdische Karte"}</div>
      </div>
    `;
  }

  document.getElementById("undergroundCount").innerText = data.undergroundCount;
  document.getElementById("remainingCount").innerText = data.remainingCount;

  const drawBtn = document.getElementById("drawCardBtn");

  if (data.gameMode === "standard" && data.undergroundCount === 5) {
    statusMsg.innerText = "⚠️ 5. unterirdische Karte gezogen! Dieser Durchgang endet jetzt.";
    statusMsg.className = "status-msg warning";
    statusMsg.style.display = "block";
    if (drawBtn) drawBtn.disabled = true;
  } else if (data.remainingCount === 0) {
    statusMsg.innerText = "🏁 Alle 11 Karten gezogen! Durchgang beendet.";
    statusMsg.className = "status-msg warning";
    statusMsg.style.display = "block";
    if (drawBtn) drawBtn.disabled = true;
  } else {
    statusMsg.style.display = "none";
    if (drawBtn) drawBtn.disabled = false;
  }
});

const modeDropdown = document.getElementById("gameModeSelect");
if (modeDropdown) {
  modeDropdown.addEventListener("change", () => {
    shuffleDeck();
  });
}


// --- 3. ZEICHENFUNKTION (MEIN CANVAS & MITSPIELER MINI-CANVAS) ---
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const boardImage = document.getElementById("boardImage");

const miniCanvas = document.getElementById("miniCanvas");
const miniCtx = miniCanvas.getContext("2d");
const miniBoardImage = document.getElementById("miniBoardImage");

let isDrawing = false;
let currentColor = "#0055A5";
let strokeWidth = 2.5;
let isEraser = false;

let drawnPaths = [];
let currentPath = null;

function syncMyCanvasToFirebase() {
  set(ref(database, `game/players/${myRole}/paths`), drawnPaths);
}

function listenToOpponentCanvas() {
  onValue(ref(database, `game/players/${opponentRole}/paths`), (snapshot) => {
    const paths = snapshot.val() || [];
    redrawMiniCanvas(paths);
  });
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pathsArray = Array.isArray(drawnPaths) ? drawnPaths : Object.values(drawnPaths);
  pathsArray.forEach(path => {
    if (!path || !path.points) return;
    const pts = Array.isArray(path.points) ? path.points : Object.values(path.points);
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    
    if (path.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 15;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  });
  ctx.globalCompositeOperation = 'source-over';
}

function redrawMiniCanvas(opponentPaths) {
  miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
  const pathsArray = Array.isArray(opponentPaths) ? opponentPaths : Object.values(opponentPaths);
  pathsArray.forEach(path => {
    if (!path || !path.points) return;
    const pts = Array.isArray(path.points) ? path.points : Object.values(path.points);
    if (pts.length < 2) return;

    miniCtx.beginPath();
    miniCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      miniCtx.lineTo(pts[i].x, pts[i].y);
    }
    
    if (path.isEraser) {
      miniCtx.globalCompositeOperation = 'destination-out';
      miniCtx.lineWidth = 15;
    } else {
      miniCtx.globalCompositeOperation = 'source-over';
      miniCtx.strokeStyle = path.color;
      miniCtx.lineWidth = path.width;
    }
    miniCtx.lineCap = "round";
    miniCtx.lineJoin = "round";
    miniCtx.stroke();
  });
  miniCtx.globalCompositeOperation = 'source-over';
}

function resizeCanvas() {
  const w = boardImage.naturalWidth || boardImage.clientWidth || 700;
  const h = boardImage.naturalHeight || boardImage.clientHeight || 700;

  canvas.width = w;
  canvas.height = h;

  miniCanvas.width = w;
  miniCanvas.height = h;

  redrawCanvas();
}

boardImage.onload = resizeCanvas;
miniBoardImage.onload = resizeCanvas;
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
  
  currentPath = {
    color: currentColor,
    width: strokeWidth,
    isEraser: isEraser,
    points: [coords]
  };
  drawnPaths.push(currentPath);

  ctx.beginPath();
  ctx.moveTo(coords.x, coords.y);
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 15;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = strokeWidth;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function draw(e) {
  if (!isDrawing || !currentPath) return;
  e.preventDefault();
  const coords = getCoordinates(e);
  currentPath.points.push(coords);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    isDrawing = false;
    currentPath = null;
    syncMyCanvasToFirebase();
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
    isEraser = false;
    const eraserBtn = document.getElementById("eraserBtn");
    if (eraserBtn) eraserBtn.classList.remove("active");
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentColor = e.target.getAttribute("data-color");
  });
});

const eraserBtn = document.getElementById("eraserBtn");
if (eraserBtn) {
  eraserBtn.addEventListener("click", () => {
    isEraser = true;
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
    eraserBtn.classList.add("active");
  });
}

const undoBtn = document.getElementById("undoBtn");
if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    drawnPaths.pop();
    redrawCanvas();
    syncMyCanvasToFirebase();
  });
}

const clearBtn = document.getElementById("clearCanvasBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (confirm("Möchtest du wirklich alle deine Linien löschen?")) {
      drawnPaths = [];
      redrawCanvas();
      syncMyCanvasToFirebase();
    }
  });
}

const drawCardBtn = document.getElementById("drawCardBtn");
if (drawCardBtn) drawCardBtn.addEventListener("click", drawCard);

const newRoundBtn = document.getElementById("newRoundBtn");
if (newRoundBtn) newRoundBtn.addEventListener("click", shuffleDeck);

shuffleDeck();
listenToOpponentCanvas();


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
