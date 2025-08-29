# Billions — Real vs Fake Swipe (v3.2)

**Fixes & Improvements**
- Strict 3-screen routing: only one screen is visible (`.active`). Nickname → Game → Game Over.
- No text overlapping: hint texts moved **under** the image (separate hint bar).
- Faster loads: smaller initial batch, staged preload (8 first), per-image timeout + fallback to Robohash.
- Diagnostics button on the start screen.

**Deploy**
Place `index.html`, `handles.json`, `styles.css`, `main.js`, `share.js`, and `/assets/billions-logo.png` at the same level. Serve as static site (Vercel: Framework None).

