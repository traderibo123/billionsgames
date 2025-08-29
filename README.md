# Real vs Fake Swipe — Billions

Swipe right for **Real** (human PFP), left for **Fake** (identicon). Uses your `handles.json` to fetch PFPs via **Unavatar** and generates **Robohash** placeholders for the fake/bot side.

## Run locally
Just open `index.html` with a local web server (not `file://`). For example, using Python:
```bash
cd <this-folder>
python3 -m http.server 5173
# then visit http://localhost:5173
```

## Deploy to Vercel
- New Project → Framework None → import this folder.
- Make sure `handles.json` is in the project root (same level as `index.html`).

## Customize
- Time limit: `main.js` → `GAME.timeLimit`
- Card count per run: `main.js` → `GAME.maxCards`
- Handles list: `handles.json` (generated from your X community page).

> Ethical note: human images are public PFPs; bot images are **representational** (Robohash). This game is for fun.
