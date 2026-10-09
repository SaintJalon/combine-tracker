# Combine Tracker — deploy & daily use

A self-contained web app for tracking prop-firm evaluations — TopStep, MyFundedFutures, Lucid,
Tradeify, Apex and Take Profit Trader. No accounts, no server, no internet needed after first load.
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

## Finding your way around
The app is split into five programs (bottom bar on a phone, top bar on desktop — or keys `1`–`5`):

| Program | What's in it |
|---|---|
| **01 Core** | Firm · plan · size picker, rebill tracker and copy trading at the top, then your day log (month calendar and day cards: net P&L, trades, notes, "followed my plan"), progress to target, buffer to floor, Coach Co, target / days / stop / max-loss, plan rules |
| **02 Intel** | Weekly Review (week net, best/worst day and setup, rule breaks, Coach Co's one fix for next week), stats, equity curve, by-setup table, searchable trade log, R-distribution, weekday / week / month breakdowns |
| **03 Protocol** | Pre-trade checklist, daily schedule, discipline score + trade cap + cooldown, your rules |
| **04 Armory** | Position size, money management, risk lab |
| **05 Path** | Attempts, funded / payout, planning & goals |

The `>_` button (or key `0`) opens **System**: Matrix / Construct theme, accent, digital rain,
CRT scanlines, animations, boot sequence, and Backup & Export. Those effect settings are per
device and don't go into backups. The header clock shows CST, which block of your schedule
you're in, and whether the Entry Guard is clear — tap either one to jump to it. A **Backup** chip
appears there when you have logged days and no export in 7+ days; tap it to export.
A **Spent** chip shows what you've paid across all accounts once any account has a rebill price;
tap it to open the rebill tracker.

Tap any section heading to fold it; folded sections stay folded next time you open the app
(handy for the account picker once it's set).

The first launch plays the intro and asks red pill (full effects) or blue pill (calm mode, no effects).
You can change that anytime in System.

## Daily routine
1. **2:00 PM CST** — platform closes (your hard stop). Open the app.
2. Pick the account you traded from the account strip under the title.
3. **Core** → tap the day (or its date on the calendar) → enter net P&L → Save. Add a mental note: did I take only A+ setups?
4. Scroll down to the buffer / consistency line. Done in under a minute.
5. **Weekend** — open **Intel → Weekly Review**: scan the week and read Coach Co's one fix for next week.
   Export a backup while you're there if the header asks for one.

Each account keeps its own log, so running two at once won't mix them up.
Tap the **Target** or **Max Loss** number on Core to match your dashboard if a firm changes its rules.

**Rebills & spend:** most evals are subscriptions that renew every 30 days from the day you bought them.
Under the size picker on Core, tap **＋ Track purchase date** and pick the day you bought the account, then tap
**Rebill price** to enter what each cycle costs (and **First payment** if you paid a different promo price up front).
Its chip in the account strip then counts the **trading days** (Mon–Fri) you have left before the next rebill
(`↻ 14 td`) — billing counts weekends and market holidays, but you can't trade them. US market holidays (New Year's,
MLK, Presidents', Good Friday, Memorial, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas) are skipped and named on
the card. Today counts until your schedule's last block
(the 2:00 PM hard stop). The chip turns amber 5 calendar days out and red the day before, and the card shows **Total spent** — plus an all-accounts total once two or more accounts
have a price. Tap **Rebills every** if your firm uses a different cycle. Once you pass or cancel, tap **Mark ended**:
the countdown stops but the spend stays in your totals (**Resume** undoes it, **Remove** deletes the record).
