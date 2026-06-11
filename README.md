# 🚀 AI Space Snake — Gesture-Controlled Snake Game

A Snake game you steer with your **hand**. Your webcam watches your index
finger using **Google MediaPipe Hand Landmarker** (an AI model that runs
fully in the browser), and JavaScript turns the fingertip position into
up / down / left / right.

No backend. No API key. No installation. Just HTML, CSS and JavaScript.

---

## 🎮 How to play

1. Allow webcam access when the page asks.
2. Hold **one hand** in front of the camera and point with your **index finger**.
3. Move your fingertip toward the edges of the camera frame to steer:
   - finger near the **top** → snake goes **up**
   - finger near the **bottom** → **down**
   - finger near the **left / right** → **left / right**
   - finger in the **center circle** → keep the current course
4. Collect 💎 crystals, avoid the walls and your own trail.
5. Backup controls: **arrow keys** or **WASD**. Press **P** or **Space** to pause.

---

## ✏️ Your task (required)

Open `script.js`. At the very top you will find the
**STUDENT CUSTOMIZATION AREA**. Change **at least these three values**:

```js
playerName: "Your Name",
gameTitle: "Your Own Game Title",
snakeSpeed: 140,            // try a different number
```

Commit your change — this proves you edited real JavaScript. 🎉

**Bonus challenges (optional):**
- Level 2: uncomment the extra food type in `FOOD_TYPES`, or invent your own
  (new emoji + new point value).
- Level 3: change `gridSize`, `winningScore`, or the colors in `style.css`.

⚠️ You do **not** need to touch `gesture-control.js` — that file contains the
AI / webcam logic and works as-is.

---

## 🌍 Deploy your fork to Vercel

1. Click **Fork** at the top of this GitHub repository.
2. Edit `script.js` in your fork (pencil icon on GitHub) and **commit**.
3. Go to [vercel.com](https://vercel.com) and sign up free with your GitHub account.
4. Click **Add New → Project**.
5. **Import** your forked repository.
6. Keep all default settings and click **Deploy**.
7. Open your public link, allow the webcam, and play!

### Test continuous deployment
Change one more value in `script.js` on GitHub and commit again.
Watch Vercel rebuild automatically — your live site updates in seconds.
That is **continuous deployment**.

> 📷 The webcam only works on `https://` links (Vercel and GitHub Pages
> both provide this) or on `localhost`. Opening `index.html` directly from
> your file manager will not work because the page uses JavaScript modules —
> use a live server or the deployed link.

---

## 📁 Project structure

| File                 | What it does                                | Edit it? |
| -------------------- | ------------------------------------------- | -------- |
| `index.html`         | Page structure                              | Optional |
| `style.css`          | Mission-control look: colors, fonts, layout | Yes      |
| `script.js`          | Game logic + **your customization area**    | **Yes**  |
| `gesture-control.js` | AI webcam hand tracking (MediaPipe)         | No       |

## 🧠 How the AI part works

```
Webcam frame
    ↓
MediaPipe Hand Landmarker (21 hand points, in-browser)
    ↓
Landmark #8 = index fingertip position
    ↓
Compare fingertip to the frame center
    ↓
"up" / "down" / "left" / "right"
    ↓
Snake game logic moves the ship
```

The AI model does not play the game — it is just a smarter **input device**,
like a keyboard made of computer vision.
