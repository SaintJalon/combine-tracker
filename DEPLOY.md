# Combine Tracker — deploy & daily use

A self-contained web app for tracking prop-firm evaluations — TopStep, MyFundedFutures, Lucid,
Tradeify, Apex and Take Profit Trader. No accounts, no server, no internet needed after first load.
Your logged P&L is saved on the device (localStorage).

## Files
- `index.html` — the app
- `rules.js` — the prop-firm math (consistency-adjusted target, tomorrow's cap, end-of-day floor); `node tests/rules.test.js` checks it
- `replay.js` — the Replay math (CSV import, CT sessions, candles, stop / target fills); `node tests/replay.test.js` checks it
- `relay/` — optional Cloudflare Worker that relays Replay's downloads (not part of the site; see its README); `node tests/relay.test.mjs` checks it
- `lightweight-charts.js` — TradingView's open-source chart library (Apache 2.0, v5.2.1), used by Replay
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
The app is split into six programs (bottom bar on a phone, top bar on desktop — or keys `1`–`6`):

| Program | What's in it |
|---|---|
| **01 Core** | Firm · plan · size picker, rebill tracker and copy trading at the top, the Copy Group's combined P&L (today / month / all time) when a leader has followers, then your day log (month calendar and day cards: net P&L, trades, notes, "followed my plan"), progress to target, buffer to floor, Coach Co, target / days / stop / max-loss, plan rules |
| **02 Intel** | Weekly Review (week net, best/worst day and setup, rule breaks, Coach Co's one fix for next week), stats, equity curve, by-setup table, searchable trade log, R-distribution, weekday / week / month breakdowns |
| **03 Protocol** | Pre-trade checklist, daily schedule, discipline score + trade cap + cooldown, your rules |
| **04 Armory** | Position size, money management, risk lab |
| **05 Path** | Attempts, funded / payout, planning & goals |
| **06 Replay** | Sparring Program: replay real market days bar by bar and trade them under your own rules, plus the Sparring Log of every session |

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

**Copy trading — groups:** you can run several copy groups at once, each with its own leader — say your TopStep
50K Static leads one group and your 100K leads another. In **Core → Copy trading**, the **Group** picker lists your
groups; pick a free account under *Start a new group led by* to make it a leader. Each group only offers accounts that
aren't already in a group (the rest are listed as taken). A new follower copies its leader from today on (**copying
since**, editable); its own days are never touched. **Stop leading** ends a group: its followers keep every day they
have — own and copied — and become free. The **Copy Group** card totals each group separately.

**Pass date:** following the plan's day targets (the cards — the live plan spreads what's left over your remaining plan
days), you pass on the last plan day that still has a target. Every day you haven't traded yet shows the date it lands on
(≈ Thu 10/22) if you trade each open session from here — today while the session is open, skipping weekends and market
holidays. The pass date is never earlier than the firm's minimum trading days (days before an account's *opened* date
don't count), and if the plan runs out of days while you're still short, the extra days it takes at the plan's average
pace are added and shown on the calendar as **Extra**. The plan heading, day cards, calendar and rebill warning all use
this one answer.

**Rebill vs pass:** with a purchase date tracked (Rebill tracker), the plan checks the next rebill against your pass
date. If the rebill lands first, a red warning above the calendar says when it charges, what it costs, how many trading
days you have before it, and the per-day pace needed to pass first — next to your plan's pace — and the calendar marks
the rebill day and the plan days after it. When you're ahead of it, a green line says so.

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

## Replay — practice on real days
**Replay** plays back a real trading day one bar at a time, so you can trade it without knowing what comes next.

1. **Get bars — download them.** Replay → Market Data → **Download bars**: pick a source, paste your API key, choose
   the symbol and dates, tap **Download**.
   - **Databento** — real CME futures (`NQ` = front month, also `ES`, `MNQ`, a contract like `NQH4`, or `NQ.FUT`).
     Pay-per-use from your Databento credit (new accounts get free credit); the cost is shown and confirmed first.
   - **Massive** (formerly Polygon) — US stocks and ETFs on the free plan (`QQQ` tracks NQ, `SPY` tracks ES), about two
     years of 1-minute bars, 5 calls a minute (the app waits out the limit). Saved at $1 per point, per ticker.

   The key is stored in this browser only — never in Backup & Export. The app calls the provider straight from the
   browser. If a provider doesn't allow that, set up the free **relay** once (a Cloudflare Worker, about 5 minutes,
   no terminal — steps in [`relay/README.md`](relay/README.md)), paste its address in **Relay** and tap **Check**;
   downloads then go through it. It forwards only Replay's market-data calls, only for your site, and holds no key.
2. **…or import a file — CSV or Excel (.xlsx).** Export 1-minute bars — TradingView's *Export chart data…* (its .xlsx
   works as is), Databento, NinjaTrader, or any file with time / open / high / low / close columns — pick the instrument (it sets $ per point) and the zone the file's
   times are in if they have none, and tap **Import CSV / Excel**. More files for the same instrument merge into one set.
3. **Set up the session.** Pick a day — or **Random day** with **Hide the date** on, so hindsight can't help you —
   the start time (default 08:30 CT), when you must be flat (default 2:00 PM CT), and how many prior days to show.
4. **Trade it.** **Play** / **Step** (or Space and →). Buy / Sell fill at the last price; stop and target (in points)
   rest as orders. **Tap the chart** to work a limit entry at that price (below the market buys, above sells): confirm
   it, and it fills once price trades through it by a tick — tap again to move it, or **Cancel limit**.
   **Drag** the stop, target or limit line to move it; a level on the wrong side of the market (where it would fill at
   once) snaps back. With **Trade under my rules** on, your account's daily stop auto-flattens you (and locks the session),
   and your trade cap and cooldown block new entries — the same rules as Core and Protocol.
5. **Review.** The Sparring Log's stats break each setup down by how you got in — **market** or **limit** — and
   compare the two overall (trades logged before V75 show as "not recorded"); Coach Co says which one is paying.
   At the end the date is revealed and **Coach Co** grades your execution (0–100): entries without a
   stop, revenge entries, sizing up after a loss, losers past 1.2R, winners cut early, the daily stop — with the one
   fix for next session. Once you have 3+ sessions, Coach Co also reads the whole **Sparring Log**: whether you're
   improving, your most repeated leak, which setups pay, your weak hour and side, and the win rate your R sizes need.
   The session goes to the **Sparring Log**: net, win rate, profit
   factor, a by-setup table, each trade's R and how far it went for / against you (MFE / MAE), and your notes.

Fills are bar-based: when one bar touches both your stop and your target, the stop counts, and a bar that opens past a
level fills at the open. Add slippage (ticks) and fees (per contract, round trip) in the setup to keep results honest.

Bars stay in this browser (IndexedDB) and are **not** part of Backup & Export — keep the CSVs. The Sparring Log is
backed up. A session in progress is saved as you go; reopen Replay and tap **Resume**.

**Share** in the Sparring Log sends a picture card of your stats and Coach Co's read through the phone's share sheet
(on a computer it saves the card and copies a text summary); your notes stay private. **CSV** exports every sparring
trade, notes included, for your own spreadsheet.
