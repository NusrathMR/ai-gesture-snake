/* =====================================================================
   SCRIPT.JS — AI Space Snake game logic
   ===================================================================== */

// ╔═══════════════════════════════════════════════════════════════════╗
// ║                  ✏️  STUDENT CUSTOMIZATION AREA  ✏️                ║
// ║                                                                   ║
// ║   Change at least ONE value below before you deploy your fork.   ║
// ║   Required for the workshop:                                     ║
// ║     1. playerName  → your own name                                ║
// ║     2. gameTitle   → your own game title                          ║
// ║     3. snakeSpeed  → try a different number                       ║
// ╚═══════════════════════════════════════════════════════════════════╝

const GAME_CONFIG = {
  playerName: "Space Explorer",   // 👈 put YOUR name here
  gameTitle: "AI Space Snake",    // 👈 invent your own title

  snakeSpeed: 220,        // milliseconds per move. BIGGER = SLOWER. Try 260 for easy mode, 140 for fast!
  pointsPerCrystal: 10,   // score for each crystal collected
  winningScore: 200,      // reach this score to complete the mission
  levelUpEvery: 5,        // crystals needed to advance one level

  snakeSymbol: "🚀",      // the ship (snake head). Try "🐍" "🛸" "🦖"
  crystalSymbol: "💎",    // the food. Try "⭐" "⚡" "🍩" "🛰️"

  snakeColor: "#5eead4",  // body trail color (any CSS color)
  gridSize: 21,           // squares per side. Bigger grid = harder game
};

// ── BONUS CHALLENGE (optional): add your own food type below! ──
// Each crystal that spawns is picked randomly from this list.
const FOOD_TYPES = [
  { symbol: GAME_CONFIG.crystalSymbol, points: GAME_CONFIG.pointsPerCrystal },
  // { symbol: "⭐", points: 30 },   // ← uncomment me, or invent your own
];

// ╔═══════════════════════════════════════════════════════════════════╗
// ║        END OF CUSTOMIZATION AREA — game engine starts here        ║
// ║     (You can read on, but you don't need to change anything.)     ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { initGestureControl } from "./gesture-control.js";

/* ----------------------------- elements ----------------------------- */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const el = {
  title: document.getElementById("game-title"),
  player: document.getElementById("player-name"),
  score: document.getElementById("score-readout"),
  best: document.getElementById("best-readout"),
  level: document.getElementById("level-readout"),
  target: document.getElementById("target-readout"),
  statusPill: document.getElementById("status-pill"),
  statusText: document.getElementById("status-text"),
  startScreen: document.getElementById("start-screen"),
  pauseScreen: document.getElementById("pause-screen"),
  pauseTitle: document.getElementById("pause-title"),
  pauseCopy: document.getElementById("pause-copy"),
  endScreen: document.getElementById("end-screen"),
  endEyebrow: document.getElementById("end-eyebrow"),
  endTitle: document.getElementById("end-title"),
  endCopy: document.getElementById("end-copy"),
  startBtn: document.getElementById("start-btn"),
  resumeBtn: document.getElementById("resume-btn"),
  restartBtn: document.getElementById("restart-btn"),
  pauseBtn: document.getElementById("pause-btn"),
};

/* --------------------------- apply config --------------------------- */

document.title = `${GAME_CONFIG.gameTitle} — Mission Control`;
el.title.textContent = GAME_CONFIG.gameTitle;
el.player.textContent = GAME_CONFIG.playerName;
el.target.textContent = GAME_CONFIG.winningScore;

const GRID = GAME_CONFIG.gridSize;
const CELL = Math.floor(canvas.width / GRID);

const BEST_KEY = "ai-space-snake-best";
let bestScore = Number(localStorage.getItem(BEST_KEY) || 0);
el.best.textContent = bestScore;

/* ----------------------------- game state --------------------------- */

let snake, direction, nextDirection, food, score, level, crystals;
let speed, timerId = null;
let running = false;   // a round is in progress
let paused = false;

function resetGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  direction = "right";
  nextDirection = "right";
  score = 0;
  level = 1;
  crystals = 0;
  speed = GAME_CONFIG.snakeSpeed;
  spawnFood();
  updateTelemetry();
}

function spawnFood() {
  const type = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  food = { ...pos, ...type };
}

/* ------------------------------ controls ---------------------------- */

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

function steer(dir) {
  // Ignore a 180° turn — a snake can't reverse into itself.
  if (dir === OPPOSITE[direction]) return;
  nextDirection = dir;
}

// AI gesture input → steer()
// Also: if the hand disappears for ~1 second mid-game, hold the mission
// automatically, and resume the moment the hand is seen again.
const HAND_LOST_GRACE_MS = 1000;
let handMissingSince = null;
let autoPaused = false;

initGestureControl({
  video: document.getElementById("webcam"),
  overlay: document.getElementById("radar-overlay"),
  onDirection: steer,
  onStatus: (state, message) => {
    el.statusPill.dataset.state = state;
    el.statusText.textContent = message;

    if (state === "tracking") {
      handMissingSince = null;
      if (autoPaused) resumeFromAutoPause();
    } else if (state === "no-hand" && running && !paused && !autoPaused) {
      if (handMissingSince === null) {
        handMissingSince = performance.now();
      } else if (performance.now() - handMissingSince > HAND_LOST_GRACE_MS) {
        autoPause();
      }
    }
    // state "error" → keyboard mode: never auto-pause.
  },
});

function autoPause() {
  autoPaused = true;
  clearInterval(timerId);
  el.pauseTitle.textContent = "Hand lost";
  el.pauseCopy.textContent =
    "Show your hand to the camera to continue the mission.";
  el.pauseScreen.classList.remove("hidden");
}

function resumeFromAutoPause() {
  autoPaused = false;
  handMissingSince = null;
  if (running && !paused) {
    el.pauseScreen.classList.add("hidden");
    restartTimer();
  }
}

// Keyboard fallback → steer()
const KEYMAP = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

document.addEventListener("keydown", (e) => {
  const dir = KEYMAP[e.key];
  if (dir) {
    e.preventDefault();
    steer(dir);
  } else if (e.key === "p" || e.key === "P" || e.key === " ") {
    e.preventDefault();
    togglePause();
  }
});

/* ----------------------------- game loop ---------------------------- */

function startRound() {
  resetGame();
  running = true;
  paused = false;
  autoPaused = false;
  handMissingSince = null;
  el.startScreen.classList.add("hidden");
  el.endScreen.classList.add("hidden");
  el.pauseScreen.classList.add("hidden");
  restartTimer();
}

function restartTimer() {
  clearInterval(timerId);
  timerId = setInterval(tick, speed);
}

function togglePause() {
  if (!running) return;

  // If we're auto-paused (hand lost), the button acts as a manual resume.
  if (autoPaused) {
    resumeFromAutoPause();
    return;
  }

  paused = !paused;
  el.pauseTitle.textContent = "Mission paused";
  el.pauseCopy.textContent = "";
  el.pauseScreen.classList.toggle("hidden", !paused);
  if (paused) clearInterval(timerId);
  else restartTimer();
}

function tick() {
  direction = nextDirection;

  const head = { ...snake[0] };
  if (direction === "up") head.y -= 1;
  if (direction === "down") head.y += 1;
  if (direction === "left") head.x -= 1;
  if (direction === "right") head.x += 1;

  // Crash into a wall or into yourself → mission over.
  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return endRound(false);

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += food.points;
    crystals += 1;

    // Level up: every few crystals the ship gets faster.
    if (crystals % GAME_CONFIG.levelUpEvery === 0) {
      level += 1;
      speed = Math.max(70, Math.round(speed * 0.88));
      restartTimer();
    }

    if (score >= GAME_CONFIG.winningScore) {
      updateTelemetry();
      return endRound(true);
    }
    spawnFood();
  } else {
    snake.pop(); // no crystal eaten → the snake doesn't grow
  }

  updateTelemetry();
  draw();
}

function endRound(won) {
  running = false;
  clearInterval(timerId);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, bestScore);
    el.best.textContent = bestScore;
  }

  el.endEyebrow.textContent = won ? "Mission complete" : "Hull breach";
  el.endTitle.textContent = won
    ? `Well flown, ${GAME_CONFIG.playerName}!`
    : "Ship lost";
  el.endCopy.textContent = `Final score: ${score} · Level ${level} · ${crystals} crystals collected`;
  el.endScreen.classList.remove("hidden");
}

/* ------------------------------ drawing ----------------------------- */

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.3 + 0.3,
}));

function draw() {
  // space background + stars
  ctx.fillStyle = "#060a16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(232, 236, 248, 0.55)";
  for (const star of STARS) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // crystal
  ctx.font = `${CELL * 0.9}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    food.symbol,
    food.x * CELL + CELL / 2,
    food.y * CELL + CELL / 2 + 1
  );

  // snake body (drawn tail-first so the head sits on top)
  for (let i = snake.length - 1; i >= 1; i--) {
    const seg = snake[i];
    const fade = 1 - (i / snake.length) * 0.6;
    ctx.globalAlpha = fade;
    ctx.fillStyle = GAME_CONFIG.snakeColor;
    roundRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4, 5);
  }
  ctx.globalAlpha = 1;

  // ship (head)
  const head = snake[0];
  ctx.font = `${CELL * 0.95}px serif`;
  ctx.fillText(
    GAME_CONFIG.snakeSymbol,
    head.x * CELL + CELL / 2,
    head.y * CELL + CELL / 2 + 1
  );
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function updateTelemetry() {
  el.score.textContent = score;
  el.level.textContent = level;
}

/* ------------------------------ buttons ----------------------------- */

el.startBtn.addEventListener("click", startRound);
el.restartBtn.addEventListener("click", startRound);
el.resumeBtn.addEventListener("click", togglePause);
el.pauseBtn.addEventListener("click", togglePause);

// Draw the opening frame behind the start screen.
resetGame();
draw();
