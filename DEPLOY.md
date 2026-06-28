# Combine Tracker — deploy & daily use

A self-contained web app for tracking TopStep 100K / 50K and Lucid / MyFundedFutures 25K
combine evaluations. No accounts, no server, no internet needed after first load.
Your logged P&L is saved on the device (localStorage).

## Files
- `index.html` — the app
- `manifest.json` — makes it installable
- `service-worker.js` — offline support + faster loads
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — home-screen icons

All paths are relative, so it works at a root domain OR a `username.github.io/repo/` subpath.

---

## Option A — ship it from github.com (no terminal)
1. Go to github.com → New repository. Name it e.g. `combine-tracker`. Public. Create.
2. On the repo page: **Add file → Upload files**. Drag in all the files above. Commit.
3. **Settings → Pages**. Under "Build and deployment", Source = **Deploy from a branch**,
   Branch = **main**, folder = **/ (root)**. Save.
4. Wait ~1 minute. Your link appears at the top of the Pages settings:
   `https://YOURNAME.github.io/combine-tracker/`
5. Open that link on your iPhone in Safari → Share → **Add to Home Screen**.
   It now opens full-screen like a real app, offline-capable.

To update later: re-upload a changed `index.html` (Add file → Upload), commit, done.

---

## Option B — let Claude Code do it (Mac terminal)
From the folder containing these files:

```bash
git init
git add .
git commit -m "Combine tracker PWA"
gh repo create combine-tracker --public --source=. --push   # needs GitHub CLI (gh)
```
Then enable Pages once:
```bash
gh api -X POST repos/:owner/combine-tracker/pages -f source.branch=main -f source.path=/
```
(or flip it on in Settings → Pages as in Option A, step 3.)

Future updates become one line:
```bash
git add . && git commit -m "update" && git push
```

---

## Daily routine
1. **2:00 PM CST** — platform closes (your hard stop). Open the app.
2. Pick the account you traded (100K / 50K / 25K → firm).
3. Tap the day → enter net P&L → Save. Add a mental note: did I take only A+ setups?
4. Glance at the buffer / consistency line. Done in under a minute.
5. **Weekend** — open it, scan the week, find the one pattern to fix.

Each account keeps its own log, so running two at once won't mix them up.
Tap the **Target** or **Max Loss** number to match your dashboard if a firm changes its rules.
