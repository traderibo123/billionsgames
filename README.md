# Billions — Real vs Fake Swipe (v3)

- Simplified **Start** screen: nickname only + large Billions logo (your provided file).
- English UI. End screen: **Share on X** + **Produced by @traderibo123**.
- Online mode via `handles.json` → Unavatar (Real) + Robohash (Fake).
- Defaults: Time=60s, Cards/run=36 (tweak in `main.js` if desired).

## Local run
```bash
python3 -m http.server 5173
# open http://localhost:5173
```

## Deploy
Upload the whole folder to Vercel (Framework: None). Ensure `handles.json` sits next to `index.html`.
