/* =====================================================================
   GESTURE-CONTROL.JS  —  the AI part of the project
   ---------------------------------------------------------------------
   ⚠️ STUDENTS: you do NOT need to edit this file.
   It loads Google's MediaPipe Hand Landmarker in the browser,
   tracks your index fingertip through the webcam, and converts the
   fingertip position into a direction: "up", "down", "left", "right".

   How it works:
     1. MediaPipe finds 21 landmarks (points) on your hand.
     2. Landmark #8 is the tip of the index finger.
     3. We compare the fingertip to the center of the camera frame.
        Outside the "dead zone" circle, the dominant axis wins:
        far left → "left", far up → "up", and so on.
     4. The game (script.js) receives the direction via a callback.
   ===================================================================== */

import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// How far (0–0.5, in normalized coordinates) the fingertip must move
// from the center before it counts as a steering command.
const DEAD_ZONE = 0.13;

// How many times per second the AI analyzes a camera frame.
// Steering a snake doesn't need more than ~12. Lower this to 8
// on a very slow computer; raise to 20 on a fast one.
const DETECTION_FPS = 12;

const INDEX_FINGERTIP = 8; // MediaPipe landmark index

/**
 * Start the camera + hand tracking.
 *
 * @param {object}   opts
 * @param {HTMLVideoElement}  opts.video       webcam <video> element
 * @param {HTMLCanvasElement} opts.overlay     canvas drawn on top of the video
 * @param {(dir: "up"|"down"|"left"|"right") => void} opts.onDirection
 * @param {(state: string, message: string) => void}  opts.onStatus
 */
export async function initGestureControl({ video, overlay, onDirection, onStatus }) {
  try {
    onStatus("boot", "Loading AI model…");
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    // Try the fast GPU path first; if the machine/browser can't do it,
    // fall back to CPU so the game still works everywhere.
    let handLandmarker;
    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
    } catch (gpuErr) {
      console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
      onStatus("boot", "Loading AI model (CPU)…");
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
    }

    onStatus("boot", "Requesting camera…");
    // Low resolution on purpose: the AI only needs a rough view of the
    // hand, and small frames are much faster to process.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    await video.play();

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    const ctx = overlay.getContext("2d");

    onStatus("no-hand", "Show your hand to the camera");

    const intervalMs = 1000 / DETECTION_FPS;
    let lastDetection = 0;

    function loop(now) {
      // Throttle: only run the (expensive) AI every `intervalMs` ms,
      // instead of on every screen refresh. This is the main speed fix
      // for slower computers.
      if (now - lastDetection >= intervalMs && video.readyState >= 2) {
        lastDetection = now;
        const result = handLandmarker.detectForVideo(video, now);

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (result.landmarks && result.landmarks.length > 0) {
          const tip = result.landmarks[0][INDEX_FINGERTIP];

          // The video is mirrored with CSS, so mirror x to match.
          const x = 1 - tip.x;
          const y = tip.y;

          const dir = directionFrom(x, y);
          drawZones(ctx, overlay.width, overlay.height, dir);
          drawFingertip(ctx, overlay.width, overlay.height, x, y, dir);

          if (dir) {
            onDirection(dir);
            onStatus("tracking", `Steering ${dir}`);
          } else {
            onStatus("tracking", "Hand locked · holding course");
          }
        } else {
          drawZones(ctx, overlay.width, overlay.height, null);
          onStatus("no-hand", "Show your hand to the camera");
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  } catch (err) {
    console.error("Gesture control failed:", err);
    const reason = (err && err.message) ? err.message : String(err);
    // Show the real reason so it's debuggable, but keep the game playable.
    onStatus("error", `AI/camera off — use keyboard (${reason.slice(0, 60)})`);
  }
}

/** Convert a normalized fingertip position into a direction (or null). */
function directionFrom(x, y) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  if (Math.hypot(dx, dy) < DEAD_ZONE) return null; // inside the dead zone

  // Whichever axis the finger moved furthest on wins.
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/* ------------------------- radar drawing ------------------------- */

const styles = getComputedStyle(document.documentElement);
const COLOR_CYAN = styles.getPropertyValue("--cyan").trim() || "#5eead4";
const COLOR_AMBER = styles.getPropertyValue("--amber").trim() || "#ffb347";
const COLOR_DIM = "rgba(140, 150, 180, 0.55)";

/**
 * Draw the four direction zones. The frame is split along its diagonals:
 *
 *        \    UP    /
 *         \        /
 *   LEFT   ( hold )   RIGHT      ← center ellipse = dead zone
 *         /        \
 *        /   DOWN   \
 *
 * These diagonal boundaries match the steering math exactly
 * (the dominant axis wins). The active zone glows cyan.
 */
function drawZones(ctx, w, h, activeDir) {
  const cx = w / 2;
  const cy = h / 2;

  // Triangle corners for each zone (apex at the center).
  const ZONES = {
    up:    [[0, 0], [w, 0], [cx, cy]],
    right: [[w, 0], [w, h], [cx, cy]],
    down:  [[w, h], [0, h], [cx, cy]],
    left:  [[0, h], [0, 0], [cx, cy]],
  };

  // Highlight whichever zone the fingertip is steering from.
  if (activeDir && ZONES[activeDir]) {
    const [a, b, c] = ZONES[activeDir];
    ctx.fillStyle = "rgba(94, 234, 212, 0.16)";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fill();
  }

  // Diagonal boundary lines between the zones.
  ctx.strokeStyle = COLOR_DIM;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, h);
  ctx.moveTo(w, 0); ctx.lineTo(0, h);
  ctx.stroke();

  // Dead zone: an ellipse matching the steering math
  // (radius = DEAD_ZONE in normalized coordinates, per axis).
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(6, 10, 22, 0.45)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, DEAD_ZONE * w, DEAD_ZONE * h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR_DIM;
  ctx.stroke();

  // Labels, each centered in its own zone. The active one lights up.
  ctx.font = "bold 12px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const labels = [
    ["up", "▲ UP", cx, h * 0.10],
    ["down", "▼ DOWN", cx, h * 0.90],
    ["left", "◀ LEFT", w * 0.11, cy],
    ["right", "RIGHT ▶", w * 0.89, cy],
  ];
  for (const [dir, text, lx, ly] of labels) {
    ctx.fillStyle = dir === activeDir ? COLOR_CYAN : COLOR_DIM;
    ctx.fillText(text, lx, ly);
  }
  ctx.fillStyle = COLOR_DIM;
  ctx.font = "10px 'IBM Plex Mono', monospace";
  ctx.fillText("HOLD", cx, cy);
}

/** Draw the glowing fingertip marker. Amber while idle, cyan while steering. */
function drawFingertip(ctx, w, h, x, y, dir) {
  const px = x * w;
  const py = y * h;
  const color = dir ? COLOR_CYAN : COLOR_AMBER;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 12, 0, Math.PI * 2);
  ctx.stroke();
}
