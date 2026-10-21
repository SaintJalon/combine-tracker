// Discord bot for a free trading community built on "Simple Start to Futures Trading" and the Combine
// Tracker — a Cloudflare Worker (free plan is plenty), so there's no server to keep running.
//
// What it does:
//   - builds the server once: roles, channels, and the whole guide posted chapter by chapter. Open /setup
//     on the worker (or run `node discord/setup.mjs`). Running it again only adds what's missing — it
//     never edits or deletes anything;
//   - answers slash commands: /dtc /md /risk /sessions /glossary /mindset /recap /journal /intro /tracker,
//     and the role buttons in #pick-your-roles;
//   - on a cron trigger (every 30 minutes) posts the trading day in Eastern time: the pre-market DTC at
//     8:00, the New York open at 9:30, the end of the 9:30–12:00 window, the 3:00 PM ET (2:00 PM CT) hard
//     stop, and Sunday's weekly review at 6:00 PM — skipping US market holidays like the tracker does.
//
// Discord talks to it over HTTPS (an "interactions endpoint"), so it needs no gateway connection and no
// privileged intents. Deploy: see discord/README.md.
//   Secrets:   DISCORD_TOKEN, DISCORD_PUBLIC_KEY, SETUP_KEY
//   Variables: DISCORD_APP_ID, GUILD_ID, optional TRACKER_URL

const API = 'https://discord.com/api/v10';
const TRACKER = 'https://saintjalon.github.io/combine-tracker/';
const ET = 'America/New_York';
const F = '```';

// Discord permission bits the bot needs: make the invite and channels, assign the self-serve roles, post.
const PERM = { invite: 1n, manageChannels: 1n << 4n, view: 1n << 10n, send: 1n << 11n, embed: 1n << 14n, history: 1n << 16n, manageRoles: 1n << 28n };
const BOT_PERMISSIONS = String(PERM.invite | PERM.manageChannels | PERM.view | PERM.send | PERM.embed | PERM.history | PERM.manageRoles);

// ─── Roles ────────────────────────────────────────────────────────────────────────────────────────────
// Created in this order — each new role lands at the bottom, so the first one ends up highest.
// `pick` puts a role on the buttons in #pick-your-roles; Mentor is handed out by the owner.
const ROLES = [
  { key: 'mentor', name: 'Mentor', color: 0xf1c40f, hoist: true, mentionable: true },
  { key: 'paid', name: 'Paid Out', emoji: '🏆', color: 0xe67e22, hoist: true, pick: 'stage' },
  { key: 'funded', name: 'Funded', emoji: '💰', color: 0x2ecc71, hoist: true, pick: 'stage' },
  { key: 'eval', name: 'In Evaluation', emoji: '📝', color: 0x3498db, hoist: true, pick: 'stage' },
  { key: 'learning', name: 'Learning', emoji: '🌱', color: 0x1abc9c, hoist: true, pick: 'stage' },
  { key: 'nq', name: 'NQ & ES', emoji: '📈', pick: 'market' },
  { key: 'gold', name: 'Gold', emoji: '🥇', pick: 'market' },
  { key: 'oil', name: 'Crude Oil', emoji: '🛢️', pick: 'market' },
  { key: 'alerts', name: 'NY Open Alerts', emoji: '🔔', mentionable: true, pick: 'alerts' }
];
const PICK_ORDER = [['learning', 'eval', 'funded', 'paid'], ['nq', 'gold', 'oil'], ['alerts']];

// ─── Guide and server posts ──────────────────────────────────────────────────────────────────────────
// Placeholders, filled in when posted: {#channel} links a channel, {/command} links a slash command,
// {tracker} is the tracker's address. Each string is one Discord message (2,000 characters max).

const WELCOME = [
  `# Welcome 👋
A free community to learn futures trading and connect with traders at every level — from your first candlestick to your first payout. It's built on the guide *Simple Start to Futures Trading* and the free Combine Tracker.

**Trading isn't gambling or guessing. It's a skill** — reading and reacting to price with discipline and patience. You don't need money to start; you need **a process** and **a mindset**. That's what this server is for.

## How it's laid out
**📖 The Guide** — free, chapter by chapter. Start at {#01-trading-basics} and work down. Open a thread on any post to ask about it, or ask in {#guide-questions}.
**☀️ Trading Day** — the daily rhythm: prep in {#premarket-dtc}, the open in {#ny-session}, setups in {#setups}, your goal in {#accountability}.
**📈 Track & Review** — the tracker ({#tracker-how-to}), {#daily-recaps}, {#trade-journal}, {#weekly-review} and {#replay-sparring}.
**🧠 Mindset** and **💰 Funding** — the parts that keep you in the game.
**🤝 Connect** — {#introductions}, {#general}, {#ask-a-trader} and {#experienced-traders}.`,
  `## Start in 3 steps
**1.** Read {#rules}, then grab your roles in {#pick-your-roles} — where you are and what you trade.
**2.** Say hi in {#introductions} — or use {/intro}.
**3.** Read the guide from {#01-trading-basics}, then follow the daily rhythm:
> **Prepare with the DTC. Execute with the MD. Protect your capital. Repeat daily.**

## The bot
Type / in any channel:
{/dtc} your Daily Trade Checklist · {/md} the MD Model · {/risk} size a trade at 0.5% · {/sessions} what's open now · {/glossary} any term from the guide · {/mindset} a reset · {/recap} post your day · {/journal} journal it · {/intro} introduce yourself · {/tracker} the free tracker
It also posts the day's rhythm in Eastern time: pre-market at 8:00, the New York open at 9:30, the end of the morning window at 12:00, the hard stop at 3:00 PM, and the weekly review on Sundays.

## The tracker
**Combine Tracker** — free, in your browser, nothing to sign up for. Daily targets for your evaluation, consistency checks, a journal, Replay to practice on real days, and Coach Co to grade your execution: {tracker}

-# Experienced trader? Hang out in {#ask-a-trader} — beginners learn fastest from people a few steps ahead. Ask a mod for the Mentor role.`
];

const RULES = [
  `# Server rules
**1. Respect everyone.** Beginners and veterans alike. No mocking questions — everyone started at their first candle.
**2. Education, not advice.** Share *why* you took a trade, not "buy now." Nothing here is financial advice.
**3. No selling, no signals, no DMs.** No paid groups, signal services, referral links or "account management" offers. Nobody legit will DM you offering to grow your account — report it to a mod.
**4. Post the whole trade.** Sharing a setup? Include entry, stop, target and the result — wins *and* losses. Losses are tuition.
**5. The lesson with the P&L.** Big days are great — tell us what you did right so others can learn from it.
**6. Right channel.** Keep each channel on its topic; anything else goes in {#general}.
**7. Protect yourself.** Never share logins, API keys or account numbers — not even with a mod.

## Risk disclaimer
Futures are leveraged: a small move in price can mean a large gain **or a large loss**. Everything in this server is for education only. Practice on evaluations or a simulator before risking money you can't afford to lose. Past results don't promise future ones.`
];

const ROLE_PICKER = [
  `# Pick your roles
Tap a button to add a role, tap it again to remove it. Roles show where you are, so traders a few steps ahead can help — and so you can find people on the same path.

**Where you are**
🌱 **Learning** — reading the guide, studying charts
📝 **In Evaluation** — working a prop-firm evaluation
💰 **Funded** — trading a funded account
🏆 **Paid Out** — you've taken a payout

**What you trade** — 📈 NQ & ES · 🥇 Gold · 🛢️ Crude Oil

🔔 **NY Open Alerts** — get pinged at 9:30 AM ET when New York opens`
];

const GUIDE_TOC = `**Contents:** {#01-trading-basics} Ch 1–5 · {#02-futures-and-funding} Ch 6–7 · {#03-the-dtc} Ch 8 · {#04-the-md-model} Ch 9 · {#05-risk-and-mindset} Ch 10 · {#06-getting-started} Ch 11–12 · {#07-glossary} Ch 13`;

const CH_BASICS = [
  `# 📖 Simple Start to Futures Trading
*The guide to become a trader — by Jalon Stringfellow. Free, chapter by chapter.*
${GUIDE_TOC}
-# Questions about a part? Open a thread on that message, or ask in {#guide-questions}.

## 1. What Trading Really Is
Trading isn't gambling or guessing. It's a skill — a way to read and react to price movement with discipline and patience.

At its core, trading is about **buying when something is undervalued and selling when it becomes overvalued.** You're not predicting the future — you're reacting to what the market is showing you.

### 💡 Why futures?
You don't need thousands of dollars to get involved. Through **prop firms** (funded accounts) you get access to large capital for a small evaluation fee — usually around **$100–$200** — so you can trade a $50,000–$100,000 account while only risking a fraction of that yourself.
- High liquidity — easy to get in and out
- Consistent volatility — movement = opportunity
- Low entry cost — through funded firms
- 24-hour market access — depending on the session

In short: you don't need money — you need **a process** and **a mindset**. That's where the checklist and the model come in. But first, let's make sure you understand what you're looking at when you open a chart.`,
  `## 2. Understanding the Basics of a Chart
Open **TradingView** (the most popular charting platform) and you're looking at a visual map of price over time. Every bar or candle tells you what buyers and sellers did during one period — 1 minute, 15 minutes, 4 hours, or a whole day.

### 🕐 Timeframes
- **1-Minute (M1)** — every small move, great for entries
- **15-Minute (M15)** — short-term structure and setups
- **4-Hour (H4)** — the big-picture direction
- **Daily (D1)** — long-term key levels and trends
Switch between them like zooming in and out of a map. **Big picture first, details later** — that's how you trade with direction.

## 3. How to Read a Candlestick
Every candle is one period of trading. **The body** shows where price opened and closed; **the wicks** (shadows) show the highest and lowest points reached.
🟩 **Bullish candle — buyers in control.** The close is higher than the open. Usually green or white.
🟥 **Bearish candle — sellers in control.** The close is lower than the open. Usually red or black.
Each candle tells a small part of the story — line up hundreds of them and you start to see **patterns, momentum and structure**.

## 4. Bulls, Bears and Market Direction
**Bulls** = buyers, they want price to go up. **Bears** = sellers, they want price to go down.
📈 **Bullish market** — higher highs and higher lows. *Gold rising $2,300 → $2,400 → $2,500.*
📉 **Bearish market** — lower highs and lower lows. *Nasdaq dropping 18,000 → 17,600 → 17,200.*
These trends form because of **liquidity** — traders placing orders at key highs and lows. The DTC teaches you to find those levels before the big moves happen.`,
  `## 5. Trading Sessions — When the Market Moves
The market runs almost 24 hours, but not all hours are equal. Different parts of the world trade at different times, creating **sessions** — each with its own rhythm. *(Times are Eastern — {/sessions} shows them in yours.)*

🌏 **Tokyo (Asia) · 7:00 PM – 4:00 AM**
Usually the calmest session. Best for marking early highs and lows and seeing overnight structure. Great for setup prep if you wake up early.

🇬🇧 **London · 2:00 AM – 11:00 AM**
Big volume and sharp moves — especially Gold, Nasdaq and FX pairs. Often sets the tone for the day and sweeps liquidity before New York opens.

🇺🇸 **New York · 8:00 AM – 5:00 PM**
The most active session for U.S. markets. Big moves often come **9:30 AM – 12:00 PM**, when the stock market opens. **The MD Model focuses on this session.**

Sessions overlap for a few hours — that's when volatility rises and most trade opportunities appear.

### ✅ Recap
- What trading is — buying and selling based on structure, not luck
- How to read a candlestick
- The difference between bulls and bears
- Why timeframes and sessions matter
- How futures give you access to large capital with small risk

**Next:** {#02-futures-and-funding}`
];

const CH_FUTURES = [
  `## 6. How Futures Trading Works
A **futures contract** is an agreement to buy or sell something at a set price in the future — Gold, Oil, Nasdaq, the S&P 500, currencies. You're not buying the commodity; you're trading its **price movement**.
*Think Nasdaq is going up? Buy a Nasdaq futures contract (NQ). Think it's going down? Sell one. When price moves your way you profit — when it moves against you, you lose.*

### Why futures are powerful
- **Small starting cost** — control a large market with a small margin (leverage)
- **Liquidity** — there are always buyers and sellers, so trades execute instantly
- **Volatility** — enough movement every day to catch multiple setups
- **No PDT rule** — take as many trades as you want, no stock restrictions
- **Extended hours** — trade nearly 24 hours a day

### Margin and leverage
You don't put up the contract's full value — just a small **margin deposit** that acts like collateral. A Nasdaq (NQ) contract might be worth **$200,000**, but your broker or prop firm might only require **$1,000–$2,000** to trade it. So a small movement in price can mean a large gain or loss — that's **leverage** in action.

### Tick value — how you actually make (or lose) money
Each contract moves in **ticks**. Nasdaq (NQ): **1 tick = 0.25 points · 1 point = $20.**
Price moves 50 points in your favor → **$1,000 profit**. 50 points against you → **$1,000 loss**.
This is why **risk management is everything** — the 0.5% rule in the MD Model controls risk on every trade. Try {/risk}.`,
  `### Popular futures to trade
${F}
Market      Symbol  Avg daily move     Best session
Nasdaq 100  NQ      200–400 points     New York
S&P 500     ES      40–100 points      New York
Gold        GC      1,000–2,000 ticks  London / New York
Crude Oil   CL      $1.00–$2.00 range  London / New York
${F}
## 7. Getting Funded Without a Big Account
Here's where most beginners get it wrong — they think they need a lot of money to start trading. You don't. Thanks to **prop firms**, you can trade funded accounts for as little as **$100–$200** up front.

A **prop trading firm** (short for "proprietary firm") gives traders access to large accounts after passing an evaluation. You prove you can manage risk and follow rules — in return, they fund you with a live account. You trade with their capital, keep a large percentage of the profits (typically **80–90%**), and they take care of losses.

### How it works
**1. Pick a firm and plan** — a futures prop firm like TopStep, MFFU or Apex. Account sizes are usually $50K, $100K or $150K.
**2. Pay the small evaluation fee** — $100–$200 on average, depending on promotions.
**3. Trade to hit the profit target** — for example, make $3,000 without breaking rules like max drawdown or the daily loss limit.
**4. Pass the evaluation** — reach the target while staying disciplined and you get a **funded account**.
**5. Start trading real capital** — keep the majority of the profits and scale up over time.`,
  `### Example
You choose a **$50,000 account** with a $3,000 profit target and a $2,000 drawdown limit, and pay $150 for the evaluation. Follow your DTC and MD Model and you can hit that target in a few trades without risking personal money. Once funded, you make real profits the firm pays out — often weekly or biweekly.

### Why funded accounts are the best way to start
- No big capital needed
- You learn real risk management
- You trade with professional rules and structure
- You can scale multiple accounts to grow income
The goal isn't to get rich fast — it's to **earn consistency first**, then **multiply it through funding**.

-# Firm rules and prices change often. The free Combine Tracker keeps each firm's current rules and turns your evaluation into a daily target: {tracker} · talk firms in {#prop-firms-and-evals}

### ✅ Recap
- What a futures contract is
- How leverage and ticks work
- Why risk management matters
- How funded accounts let you trade big with a small personal investment

**Next:** {#03-the-dtc}`
];

const CH_DTC = [
  `## 8. The DTC — Daily Trade Checklist
If you want to trade consistently you need **structure** — not vibes, not luck, not "hope." The **Daily Trade Checklist** is your roadmap every single day. It keeps you focused on the *process*, not the profits. Follow it step by step and you remove emotion and trade on logic, levels and timing.

### Why you need the DTC
Most traders lose because they just open a chart and "look for setups." Professionals prepare before the market even opens. The DTC forces you to prepare with a plan — so when price moves, you react calmly instead of guessing. It works **top-down**: from the big picture (higher timeframes) down to the small ones (entry timeframes).
-# {/dtc} gives you a checklist to tick off every morning.

### Step 1 — Mark weekly key levels
Every week, mark the **previous week's high and low**. They often act as magnets — price loves to grab liquidity above or below them before reversing.
*If Nasdaq breaks last week's high and quickly falls back below, buyers were trapped — a potential short setup zone.*
Tip: these weekly levels often line up with your future targets (PDH/PDL).

### Step 2 — Mark the previous day's high & low (PDH / PDL)
Price almost always interacts with one of these during the session. They're your first major liquidity zones. When price sweeps above PDH or below PDL, you often get your manipulation signal — especially before a big move in London or New York.

### Step 3 — Mark session highs and lows
- **Tokyo (7 PM – 4 AM ET)** — sets overnight structure
- **London (2 AM – 11 AM ET)** — creates volatility and sweeps liquidity
- **New York (8 AM – 5 PM ET)** — confirms the main move of the day
Price often grabs liquidity in one session and makes its main move in another — London takes liquidity above a high → New York reverses it.`,
  `### Step 4 — Mark the 4-hour range & identify FVGs
On the **4-hour** timeframe:
- Mark the high and low of the **6 AM 4-hour candle**
- Highlight the **10 AM 4-hour open** (used for directional bias)
- Mark any **Fair Value Gaps (FVGs)** — areas of imbalance between candles that price often returns to fill
This tells you the "macro direction" for the day — are we in **premium** (sell zone) or **discount** (buy zone)?

### Step 5 — Drop to the 1-hour
Identify smaller **FVGs** or **Order Blocks (OBs)** inside the larger structure. You're refining your areas of interest — where price might want to react. This connects your 4-hour direction to your intraday plan.

### Step 6 — Drop to the 15-minute
Now you're in execution prep. Look for:
- Smaller FVGs that line up with your higher-timeframe ones
- Areas where price is likely to return before a big move
- Clues of **market manipulation** — fake breakouts or liquidity grabs
This is the sweet spot where you start seeing setups that fit your model.

### Step 7 — Identify order blocks & liquidity areas
An **Order Block** is the last bullish or bearish candle before a strong move in the opposite direction — it shows where smart money (institutions) entered. Look for OBs near your FVGs or key levels (PDH, PDL, weekly high/low), and check for **liquidity** nearby: equal highs, equal lows, or clean trendlines. Those areas are *targets or reversal points*.

### Step 8 — Wait for market manipulation before entry
Before any real move there's usually manipulation. The market grabs liquidity above or below a key level to trap traders — then reverses. A stop-hunt or fakeout near one of your marked zones is **your early warning** that a setup is forming.`,
  `### Step 9 — Confirm before entering
Before you pull the trigger, ask:
- Is price reacting at a key level, OB or FVG?
- Did we just have a **Market Structure Shift (MSS)**?
- Is there **displacement** — strong, impulsive movement?
- Are volume and liquidity supporting the move?
If everything lines up — *that's* when you execute. Not before.

### Step 10 — Execute & manage the trade
- Risk **0.5% of your account** per trade ($50,000 account = $250 risk)
- Use a **1:4 risk-to-reward** ratio
- Move your stop loss to **breakeven** once you hit 1:2
- Take partial profits and trail the rest
**Never move your stop loss against you — ever.** Discipline protects profits better than analysis does.

### Step 11 — Post-trade review
After every trade:
- Write down why you entered, how you managed it, and how it ended
- Screenshot your setup
- Note what you did right and what to improve
This step separates amateurs from professionals. *The goal isn't perfection — it's progress.* Post it with {/journal}.

### DTC summary
Your Daily Trade Checklist gives you structure, patience and precision. Follow it daily and your trading becomes a repeatable process:
> **Plan first → Wait for confirmation → Execute with discipline.**
You stop chasing trades — and start *catching structure.*

**Next:** {#04-the-md-model}`
];

const CH_MD = [
  `## 9. The MD Model — Turning Structure Into Profitable Entries
-# {/md} brings this up anytime.

### 1 · Mark the 9:30 opening range (5-minute chart)
When the New York Stock Exchange opens at **9:30 AM ET**, mark the **high and low of the first 5-minute candle**. This is your **opening range** — the zone where liquidity builds up early in the session. Price breaks above it → buyers are showing strength. Breaks below → sellers are. This range sets your framework for the morning.

### 2 · Wait for displacement (1-minute chart)
Drop to the **1-minute chart** and watch closely. A **displacement candle** is a large-bodied candle that breaks out of your 5-minute range *with force*. It shows intent — momentum and aggression from one side of the market. One side just took control.

### 3 · Look for a Fair Value Gap (FVG)
Right after that displacement candle forms, look for a **Fair Value Gap** — the empty space between the wicks of consecutive candles where price didn't trade. That gap is **imbalanced** — price moved too fast and will often return to it. **This FVG becomes your entry zone.** Wait for price to pull back into it, then trade in the direction of displacement.

### 4 · Entry options
**Aggressive** — enter as soon as price re-enters the FVG after displacement. Works best when momentum is strong and confluences align.
**Conservative** — wait for confirmation: a rejection wick from the FVG zone, an engulfing candle in your direction, or a Market Structure Shift (MSS) confirming continuation.
Conservative keeps you safer but may miss fast moves. Choose what fits your confidence and rules.

### 5 · Stop loss placement
**Fixed stop** — 20 points (on Nasdaq, for example).
**Structure-based stop** — below the displacement candle for longs, above it for shorts.
Your stop is always logical and protected by structure — not emotion.`,
  `### 6 · Take-profit targets
Your targets depend on structure and context.
**Fixed target** — 50 points (Nasdaq).
**Structure target (preferred):**
- Previous Day High (PDH) for longs
- Previous Day Low (PDL) for shorts
- Session high or low if trending
- The next major unfilled Fair Value Gap
Tip: choose the TP that lines up with your higher-timeframe narrative from the DTC.

### 7 · Filters and rules
- **HTF bias** — trade in the direction of the 1H or 4H structure
- **News filter** — skip 15 minutes before and after high-impact news (CPI, FOMC, etc.)
- **Liquidity sweep** — prefer setups that happen *after* a stop-hunt or fakeout
- **Trade limit** — maximum of 2 trades per day. Discipline over frequency.

### 8 · Managing the trade
Once you're in:
- Move your stop to **breakeven** when price reaches halfway to your TP
- Take partial profits and let the rest ride
- If price comes back and breaks structure against you — exit early
Protect capital first, profits second. Every decision after entry should be about **preservation**, not greed.`,
  `### 9 · Example — an NQ short
1. It's 9:30 AM — you mark the first 5-minute candle's range
2. On the 1-minute, a strong bearish displacement candle breaks below that range
3. You spot an FVG right after the move
4. Price retraces into the FVG — you enter short
5. Stop loss goes just above the displacement candle
6. Target: Previous Day Low (PDL)
7. Price hits TP within the session
8. You log it, review it, and move on
That's it — clean, mechanical and emotion-free.

### Key principles to remember
> **Never enter without displacement.**
> **Always trade in the direction of higher-timeframe bias.**
> **Let price come to your zone — never chase.**
> **Secure profits at 1:2 RR, trail the remainder if the market keeps pushing.**
> **Two trades max per day — patience pays.**

### Summary
Your **MD Model** is your edge — a precise framework to turn analysis into execution, built on logic, not luck. Combine **the DTC** (preparation and structure) with **the MD Model** (execution and precision) and you trade like a funded professional — consistent, calm and confident.
Share setups that fit the model in {#setups}.

**Next:** {#05-risk-and-mindset}`
];

const CH_MINDSET = [
  `## 10. Risk, Psychology & Staying Consistent
You can have the best strategy in the world, but if your mind isn't right, it won't matter. Trading success doesn't come from your entries — it comes from **your discipline, patience and mindset**. This is the part that separates funded, consistent traders from the ones who keep resetting accounts.

### 1 · The real job of a trader
Your job isn't to *make money every day.* Your job is to:
- Protect your capital
- Follow your process
- Execute only when your rules line up
Do that and the money shows up. The traders who last treat trading like a job — not a gamble.

### 2 · Risk small, think big
Risk control is what keeps you alive long enough to grow. Your rule: **risk 0.5% per trade.** That's it.
$50,000 account → **$250** max loss per trade. Two trades a day → **$500** total exposure.
That small risk gives you room to stay calm, think clearly and let setups come to you. The moment you increase size to "make it back," you lose your edge. Small, consistent wins compound faster than emotional gambling ever will.

### 3 · The emotional cycle of trading
- **Greed** — after a win, you want more
- **Fear** — after a loss, you hesitate or force a revenge trade
- **Doubt** — you start questioning your system after one bad day
- **Ego** — you think you've "figured it out," then stop following rules
Your mission is to stay in control no matter which side of the cycle you're on.
**After a win:** close the charts, take your profit, and walk away.
**After a loss:** review what happened, reset your mindset, and stick to the plan.
**Never let emotion write your next trade.**`,
  `### 4 · The power of a daily goal
Set a clear, realistic target each day — not just for profit, but for process.
*Example: daily profit goal **$600** · max daily loss **$500** · stop trading once either is hit.*
This keeps you consistent and emotionally neutral. Up $550? You don't need to chase the last $50. Walk away — being disciplined *is the win.* Post yours in {#accountability}.

### 5 · The funded trader mindset
With a funded account the goal is survival and consistency — you're managing *someone else's capital*, so every rule matters. Funded traders focus on:
**Longevity over luck · Process over prediction · Execution over excitement.**
Trading is a **business**, not a thrill. Your product is your discipline. Your income comes from your patience.

### 6 · Building emotional insulation
You'll have losing days — even losing weeks. That's normal. What matters is how you respond:
1. Review, don't react
2. Look at your screenshots and notes
3. Find *why* you lost — was it a bad setup or a rule break?
4. Adjust and move on
**Losses are tuition** — they're what you pay to learn the craft. Share yours in {#wins-and-lessons}.

### 7 · The circle of control
${F}
What you CAN control     What you CAN'T control
Your risk per trade      If the trade wins or loses
Your entry timing        How far price moves
Your discipline          Market volatility
Your emotions            News events
${F}
The more you focus on what you **can** control, the less stress you'll feel and the more consistent you'll become.`,
  `### 8 · Journaling and reflection
After each trading day:
- Record your setups (screenshots, entry, stop, TP)
- Note how you felt before and after
- **Grade yourself on discipline — not just profit**
This is how you track progress and spot patterns in your behavior. Your biggest improvements will come from better patience, not new setups. Use {/journal} in {#trade-journal}.

### 9 · The mindset of scaling
Once you've mastered control and consistency, scaling becomes easy. You repeat the same process across **multiple funded accounts.** The numbers get bigger, but the process never changes.
> *"Consistency comes first. Size comes later."*

### Summary
Being a funded trader isn't about calling tops and bottoms. It's about following your checklist, applying your model and managing your emotions day after day.
- Risk small
- Stay patient
- Follow your process
- Walk away when the job's done
That's how you go from learning charts to **making a living off them.**

**Next:** {#06-getting-started}`
];

const CH_START = [
  `## 11. Getting Started Today
You've learned how the market works, how to read charts, how to trade with structure, and how to manage your emotions. Now put it together and take your **first real steps** as a trader — not rushing, *starting smart and moving with purpose.*

### Step 1 — Set up your trading platform
Start with **TradingView** — beginner-friendly, visual, and works on desktop and mobile.
1. Go to tradingview.com and create a free account
2. Add the charts you'll focus on — **NASDAQ (NQ1!)**, **GOLD (GC1!)**, **CRUDE OIL (CL1!)**
3. Set your time zone to **Eastern**
4. Save your favorite timeframes: **4H** (bias) · **1H** (structure) · **15M** (setup) · **5M and 1M** (entry with the MD Model)
5. Keep your chart clean — price action only. No unnecessary indicators. Just levels, FVGs and structure.
*Tip: create a "template chart" with your DTC layout — weekly levels, PDH/PDL and sessions already marked.*

### Step 2 — Learn to mark levels daily
Before the market opens, do your **DTC**: weekly highs and lows · previous day high (PDH) and low (PDL) · session highs and lows · Fair Value Gaps and Order Blocks · potential manipulation zones.
This daily prep keeps you sharp. Do it every morning before 9:30 AM ET and you'll start seeing patterns naturally — price *respects structure*, grabs liquidity, then moves to your targets, exactly like the model teaches. Post your prep in {#premarket-dtc}.

### Step 3 — Study candles and price action
Spend a few minutes each day watching the **1-minute chart** live. Watch how candles form, where they reject, and how they react to FVGs or order blocks. You're training your eye to see **intent** — momentum and control. Ask yourself:
- Who's in control right now — bulls or bears?
- Did we just sweep liquidity?
- Where's the imbalance (FVG)?
- Where might price go next?
The more you observe, the faster these patterns become second nature.`,
  `### Step 4 — Pick a futures prop firm
When you're confident with your DTC and MD practice, start a **funded evaluation**. A few trusted options to begin with:
${F}
Prop firm               Typical eval   Payout   Highlight
TopStep                 ~$150–$200     90%      Industry veteran, reliable payouts
MFFU (MyFundedFutures)  ~$100–$150     85–90%   Fast evaluations, low cost
Apex Trader Funding     ~$80–$150      90%      Frequent discounts and sales
${F}
You don't need more than one to start — focus on **passing one evaluation at a time.**
-# Prices change with promotions — the tracker keeps each firm's current rules: {tracker}

### Step 5 — Follow your process daily
Use your **DTC** every morning and your **MD Model** for entries. That's your rhythm.
- Trade **only during your session** (New York)
- Take **only setups that meet your rules**
- Respect your **daily goal and loss limit**
You don't need 10 trades a day — you need *one good trade executed properly.* Remember: *you're not chasing profits — you're building proof of consistency.*

### Step 6 — Journal everything
After each trade:
- Record screenshots
- Write your thought process — *What did I see? Why did I take it? Did I follow my plan?*
- Grade yourself on **discipline**, not results
This daily feedback loop grows your consistency faster than any new indicator or "secret strategy."`,
  `### Step 7 — Keep emotions in check
You'll have losing trades. You'll have days where you feel stuck or second-guess yourself. That's normal. What matters is **how you respond** — not what happens.
Stick to your structure. Trust your model. Respect your risk.
Every professional trader went through the same process. The difference is — they didn't quit when it got uncomfortable.

### Step 8 — Scale up when ready
Once you've proven consistency:
- Add more funded accounts
- Combine profits from multiple firms
- Stay within your daily goals
The goal isn't one big trade — it's steady, compounding growth through discipline.

## 12. From Student to Funded Trader
Everything in this guide — **the basics, the checklist and the model** — gives you the same foundation funded traders use every single day.
You don't need luck. You don't need to guess. You just need repetition, patience and belief in your system.
> **Prepare with the DTC.**
> **Execute with the MD.**
> **Protect your capital.**
> **Repeat daily.**
That's how you go from learning candles to living off consistency.
-# Look up any term in {#07-glossary} or with {/glossary}.`
];

// Chapter 13, plus the guide's own shorthand (PDH/PDL, DTC, MD Model) so /glossary knows them too.
const GLOSSARY = [
  ['Futures', 'A contract to trade the price movement of assets like Nasdaq, Gold, or Oil without owning them physically.'],
  ['Contract', 'A standardized trade unit for a futures product (e.g., one Nasdaq futures contract).'],
  ['Leverage', 'Borrowed buying power that lets you control large market value with a small deposit.'],
  ['Margin', 'The minimum capital required to enter a trade (like a temporary deposit).'],
  ['Tick', 'The smallest possible price movement in a futures contract.'],
  ['Point', 'A bigger movement made up of ticks (e.g., 1 NQ point = $20).'],
  ['Candlestick', 'A visual bar showing price movement in a set time period (open, high, low, close).'],
  ['Bullish Candle', 'A candle that closes higher than it opened (buyers pushed price up — "bulls").'],
  ['Bearish Candle', 'A candle that closes lower than it opened (sellers pushed price down — "bears").'],
  ['Wick', 'The high and low price reached during the candle, beyond the body.'],
  ['Trend', 'The overall direction of price movement: uptrend (bullish) or downtrend (bearish).'],
  ['Liquidity', "Areas where traders' stop losses or orders are likely stacked, often around equal highs/lows or obvious structure."],
  ['Liquidity Grab / Stop Hunt', 'A planned move by smart money to trigger trader stop losses before reversing.'],
  ['Fair Value Gap (FVG)', 'A gap between candles caused by an aggressive move (an imbalanced price area that price often returns to fill).'],
  ['Order Block (OB)', 'The last bullish or bearish candle before a strong opposite-direction move. Often a smart money entry zone.'],
  ['Displacement Candle', 'A large impulsive candle that shows aggressive smart money entry, breaking structure or sweeping liquidity.'],
  ['BOS (Break of Structure)', 'Price breaks a previous high or low within a trend, confirming continuation.'],
  ['CHoCH (Change of Character)', 'A significant break in structure showing a potential reversal from uptrend to downtrend or vice versa.'],
  ['MSS (Market Structure Shift)', 'Signals a change in market direction, often seen after liquidity is swept.'],
  ['Premium Zone', 'Price area above equilibrium — considered "expensive" (ideal for selling in bearish conditions).'],
  ['Discount Zone', 'Price area below equilibrium — considered "cheap" (ideal for buying in bullish conditions).'],
  ['Equilibrium (EQ or 50%)', 'The midpoint between a swing high and swing low — used to judge premium vs discount zones.'],
  ['Opening Range (9:30 Range)', 'The high and low of the first 5-minute candle after the market opens at 9:30 AM ET. Used for direction in the MD Model.'],
  ['RR (Risk-to-Reward Ratio)', 'How much you risk vs how much you aim to gain (e.g., 1:4 = risk $1 to make $4).'],
  ['Breakeven (B/E)', 'Adjusting your stop loss to entry price so the trade cannot lose money.'],
  ['Prop Firm', 'A company that funds traders who pass an evaluation, allowing them to trade larger accounts.'],
  ['Evaluation / Challenge', 'A test phase where you must hit a profit target while respecting max loss rules to earn a funded account.'],
  ['Drawdown', 'The maximum allowed loss (daily or overall) before failing the evaluation/funded account.'],
  ['Scaling', 'Increasing your profit capacity by trading multiple funded accounts or upgrading account size.'],
  ['Session', 'Different trading windows: Tokyo (7 PM–4 AM ET), London (2 AM–11 AM ET), New York (8 AM–5 PM ET).'],
  ['PDH / PDL (Previous Day High / Low)', "Yesterday's high and low — your first major liquidity zones each day. A sweep of either is often the manipulation before the real move."],
  ['DTC (Daily Trade Checklist)', 'The 11-step top-down prep you do before the open: weekly levels, PDH/PDL, sessions, 4H/1H/15m FVGs and order blocks, then wait, confirm, execute and review.'],
  ['MD Model', 'The entry model: mark the 9:30 opening range on the 5-minute, wait for displacement on the 1-minute, and enter on the pullback into the Fair Value Gap it leaves.']
];

// As many messages as it takes, each kept well under Discord's 2,000 characters.
function glossaryPosts() {
  const out = [`## 13. Glossary\n-# Look any of these up with {/glossary}.\n`];
  for (const [t, d] of GLOSSARY) {
    const line = `**${t}** — ${d}`;
    if (out[out.length - 1].length + line.length > 1800) out.push(line); else out[out.length - 1] += '\n' + line;
  }
  out[out.length - 1] += '\n\n**Back to the start:** {#01-trading-basics}';
  return out;
}

const TRACKER_HOWTO = [
  `# 📈 The Combine Tracker
A free app for passing prop-firm evaluations — TopStep, MyFundedFutures, Lucid, Tradeify, Apex and Take Profit Trader. No account, no sign-up: it runs in your browser, works offline, and your data stays on your device. Add it to your phone's home screen and it opens like an app.
**Open it:** {tracker}

### What's inside
**01 Core** — pick your firm, plan and size, and it turns the target into a day-by-day plan. **Today's plan** gives the next session's target, max loss, risk per trade and when to walk away. Log each day's P&L in under a minute.
**02 Intel** — Weekly Review, stats, equity curve, by-setup table, searchable trade log
**03 Protocol** — pre-trade checklist, daily schedule, discipline score, trade cap and cooldown
**04 Armory** — position size, money management, risk lab
**05 Path** — attempts, funded and payouts, goals
**06 Replay** — replay real market days bar by bar and trade them under your own rules
**07 Journal** — mood and sleep before the open, your plan, discipline 1–5, the lesson and one thing for tomorrow

**Coach Co** reviews every logged day: a 0–100 execution grade, what went wrong (worst first), what went right, and the one fix for next session — written with your own numbers.`,
  `### The daily routine
**1.** **2:00 PM CT / 3:00 PM ET** — hard stop. Open the tracker.
**2.** Pick the account you traded → **Core** → tap the day → enter net P&L → Save. Did you take only A+ setups?
**3.** Check the buffer and consistency line. Done in under a minute.
**4.** Post a {/recap} in {#daily-recaps} and a {/journal} in {#trade-journal}.
**5.** **Weekend** — **Intel → Weekly Review**: scan the week, read Coach Co's one fix, and share it in {#weekly-review}.
Practicing in **Replay**? Share your Sparring Log card in {#replay-sparring}.

### Good to know
- Each account keeps its own log, so you can run several evaluations without mixing them up. Copy groups handle a leader account and its followers.
- It tracks **rebills**: the trading days left before your next charge, and a warning if a rebill lands before your pass date.
- Your data lives on your device only — **back it up** from the >_ System menu.
Questions, ideas or bugs → {#tracker-help}`
];

// ─── Server layout ───────────────────────────────────────────────────────────────────────────────────
// Read-only channels: only the bot (and admins) post, so the guide stays clean — members can still react
// and open a thread on any post. Text channel names must stay lowercase-with-hyphens; that's how Discord
// stores them, and setup finds what already exists by name.
const CATEGORIES = [
  { name: '📌 START HERE', channels: [
    { name: 'welcome', readOnly: true, topic: 'What this server is and how to use it — start here.', posts: WELCOME },
    { name: 'rules', readOnly: true, topic: 'Community rules and the risk disclaimer.', posts: RULES },
    { name: 'pick-your-roles', readOnly: true, topic: 'Tap a button to add or remove a role.', posts: ROLE_PICKER, buttons: true },
    { name: 'announcements', readOnly: true, topic: 'News about the server, the guide and the tracker.' },
    { name: 'introductions', topic: 'Say hi: what you trade, your session, where you are (learning / evaluation / funded) and one goal for this month. Or use /intro.' }
  ] },
  { name: '📖 THE GUIDE — FREE', channels: [
    { name: '01-trading-basics', readOnly: true, topic: 'Ch 1–5: what trading is, charts and timeframes, candlesticks, bulls and bears, sessions.', posts: CH_BASICS },
    { name: '02-futures-and-funding', readOnly: true, topic: 'Ch 6–7: futures contracts, margin and leverage, tick value, prop firms and funded accounts.', posts: CH_FUTURES },
    { name: '03-the-dtc', readOnly: true, topic: 'Ch 8: the Daily Trade Checklist — 11 steps, top-down, before the open. /dtc', posts: CH_DTC },
    { name: '04-the-md-model', readOnly: true, topic: 'Ch 9: the MD Model — 9:30 opening range, displacement, FVG entry, stops, targets, rules. /md', posts: CH_MD },
    { name: '05-risk-and-mindset', readOnly: true, topic: 'Ch 10: risk, psychology and staying consistent — how to think like a funded trader. /mindset', posts: CH_MINDSET },
    { name: '06-getting-started', readOnly: true, topic: "Ch 11–12: your step-by-step plan to begin, and the final message: from student to funded trader.", posts: CH_START },
    { name: '07-glossary', readOnly: true, topic: 'Ch 13: every term in the guide. /glossary', posts: glossaryPosts() },
    { name: 'guide-questions', topic: 'Ask about any chapter — no question is too basic.' }
  ] },
  { name: '☀️ TRADING DAY', channels: [
    { name: 'premarket-dtc', topic: 'Before 9:30 AM ET: post your DTC levels and bias. The bot posts the checklist at 8:00 AM ET. /dtc' },
    { name: 'ny-session', topic: 'The New York open, live: opening range at 9:30 AM ET, displacement, FVG. Two trades max.' },
    { name: 'setups', topic: 'Post setups with entry, stop, target and result — wins and losses. Did it fit the MD Model?' },
    { name: 'accountability', topic: 'Post your daily goal and max loss before the open. Check back in when you stop.' }
  ] },
  { name: '📈 TRACK & REVIEW', channels: [
    { name: 'tracker-how-to', readOnly: true, topic: 'The free Combine Tracker: what it does and the daily routine.', posts: TRACKER_HOWTO },
    { name: 'daily-recaps', topic: 'After your hard stop: /recap — P&L, trades, did you follow your plan.' },
    { name: 'trade-journal', topic: '/journal — what you saw, why you took it, did you follow your plan. Grade discipline, not results.' },
    { name: 'weekly-review', topic: 'Sundays: week net, best and worst day, rule breaks, and one fix for next week.' },
    { name: 'replay-sparring', topic: "Practice on real days in the tracker's Replay and share your Sparring Log card." },
    { name: 'tracker-help', topic: 'Questions, ideas and bugs for the Combine Tracker.' }
  ] },
  { name: '🧠 MINDSET', channels: [
    { name: 'psychology', topic: 'Greed, fear, doubt, ego — talk it through. /mindset for a reset.' },
    { name: 'wins-and-lessons', topic: 'Losses are tuition. Share the win and the lesson.' }
  ] },
  { name: '💰 FUNDING', channels: [
    { name: 'prop-firms-and-evals', topic: 'TopStep, MFFU, Apex, Lucid, Tradeify… rules, promos, and passing (or failing) evaluations.' },
    { name: 'payouts', topic: 'Got paid? Post it — and what got you there.' }
  ] },
  { name: '🤝 CONNECT', channels: [
    { name: 'general', topic: 'Anything trading — or not.' },
    { name: 'ask-a-trader', topic: 'Beginners: ask anything. Experienced traders: this is where you give back.' },
    { name: 'experienced-traders', topic: 'Deeper talk: scaling multiple accounts, copy trading, execution, the business side. Everyone can read and learn.' },
    { name: 'Trading Floor', voice: true },
    { name: 'Study Hall', voice: true }
  ] }
];

// ─── Placeholders ────────────────────────────────────────────────────────────────────────────────────
function render(text, ctx = {}) {
  return text
    .replace(/\{#([a-z0-9-]+)\}/g, (_, n) => (ctx.channels && ctx.channels[n] ? `<#${ctx.channels[n]}>` : '#' + n))
    .replace(/\{\/([a-z]+)\}/g, (_, n) => (ctx.commands && ctx.commands[n] ? `</${n}:${ctx.commands[n]}>` : '/' + n))
    .replace(/\{@([a-z]+)\}/g, (_, k) => (ctx.roles && ctx.roles[k] ? `<@&${ctx.roles[k]}>` : '@' + roleByKey(k).name))
    .replace(/\{tracker\}/g, ctx.tracker || TRACKER);
}
const roleByKey = (k) => ROLES.find((r) => r.key === k);

function rolePickerComponents() {
  return PICK_ORDER.map((row) => ({
    type: 1,
    components: row.map((k) => { const r = roleByKey(k); return { type: 2, style: 2, label: r.name, emoji: { name: r.emoji }, custom_id: 'role:' + k }; })
  }));
}

// The messages a channel should hold, in order, ready to send.
function channelMessages(ch, ctx) {
  return (ch.posts || []).map((p, i) => {
    const m = { content: render(p, ctx), allowed_mentions: { parse: [] } };
    if (ch.buttons && i === ch.posts.length - 1) m.components = rolePickerComponents();
    return m;
  });
}

// ─── Eastern time and the market calendar ────────────────────────────────────────────────────────────
const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
// {y, mo, d, h, mi, dow, iso} of a moment, on the New York clock.
function etParts(ms) {
  const p = {};
  for (const x of etFmt.formatToParts(new Date(ms))) p[x.type] = +x.value;
  const y = p.year, mo = p.month, d = p.day;
  return { y, mo, d, h: p.hour % 24, mi: p.minute, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), iso: isoOf(y, mo, d) };
}
// The moment it is y-mo-d h:mi in New York (handles daylight saving either way).
function etToUtc(y, mo, d, h, mi) {
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let t = want + 5 * 3600e3;
  for (let k = 0; k < 2; k++) { const p = etParts(t); t += want - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi); }
  return t;
}
const isoOf = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function addDays(y, mo, d, n) { const t = new Date(Date.UTC(y, mo - 1, d + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }

// US stock market holidays — the same rules as the tracker: a Saturday holiday closes the Friday before
// and a Sunday one the Monday after, except New Year's on a Saturday, which isn't made up.
const holCache = {};
function holidayOn(iso) { return marketHolidays(+iso.slice(0, 4))[iso] || null; }
function marketHolidays(y) {
  if (holCache[y]) return holCache[y];
  const h = {};
  const put = (dt, name) => { h[isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())] = name; };
  const fixed = (m, d, name, noSat) => { const dt = new Date(Date.UTC(y, m, d)), w = dt.getUTCDay(); if (w === 6) { if (noSat) return; dt.setUTCDate(d - 1); } else if (w === 0) dt.setUTCDate(d + 1); put(dt, name); };
  const nth = (m, wd, n, name) => { const dt = new Date(Date.UTC(y, m, 1)); dt.setUTCDate(1 + ((wd - dt.getUTCDay() + 7) % 7) + (n - 1) * 7); put(dt, name); };
  const last = (m, wd, name) => { const dt = new Date(Date.UTC(y, m + 1, 0)); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() - wd + 7) % 7)); put(dt, name); };
  fixed(0, 1, "New Year's Day", true);
  nth(0, 1, 3, 'MLK Day'); nth(1, 1, 3, "Presidents' Day");
  const gf = easterSunday(y); gf.setUTCDate(gf.getUTCDate() - 2); put(gf, 'Good Friday');
  last(4, 1, 'Memorial Day');
  if (y >= 2022) fixed(5, 19, 'Juneteenth');
  fixed(6, 4, 'Independence Day');
  nth(8, 1, 1, 'Labor Day'); nth(10, 4, 4, 'Thanksgiving');
  fixed(11, 25, 'Christmas');
  return (holCache[y] = h);
}
// Gregorian Easter (anonymous / Meeus algorithm), for Good Friday.
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), x = h + l - 7 * m + 114;
  return new Date(Date.UTC(y, Math.floor(x / 31) - 1, (x % 31) + 1));
}

// The guide's sessions, Eastern time. `days` = weekdays a session opens on; Tokyo opens Sunday–Thursday
// evenings because futures reopen Sunday at 6 PM ET and close Friday at 5 PM ET.
const SESSIONS = [
  { name: 'Tokyo', icon: '🌏', open: [19, 0], close: [4, 0], days: [0, 1, 2, 3, 4] },
  { name: 'London', icon: '🇬🇧', open: [2, 0], close: [11, 0], days: [1, 2, 3, 4, 5] },
  { name: 'New York', icon: '🇺🇸', open: [8, 0], close: [17, 0], days: [1, 2, 3, 4, 5], usHolidays: true },
  { name: 'NY AM window', icon: '⏱', open: [9, 30], close: [12, 0], days: [1, 2, 3, 4, 5], usHolidays: true, note: "the MD Model's window" }
];
// The session's current or next window: {open, close, now: true if it's open}.
function sessionWindow(s, ms) {
  const t = etParts(ms);
  for (let k = -1; k <= 10; k++) {
    const [y, mo, d] = addDays(t.y, t.mo, t.d, k), dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    if (!s.days.includes(dow) || (s.usHolidays && holidayOn(isoOf(y, mo, d)))) continue;
    const open = etToUtc(y, mo, d, s.open[0], s.open[1]);
    const [cy, cm, cd] = s.close[0] < s.open[0] ? addDays(y, mo, d, 1) : [y, mo, d];
    const close = etToUtc(cy, cm, cd, s.close[0], s.close[1]);
    if (close > ms) return { open, close, now: open <= ms };
  }
  return null;
}
const hm12 = ([h, m]) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
const ts = (ms, f) => `<t:${Math.floor(ms / 1000)}:${f}>`;

function sessionsText(ms) {
  const t = etParts(ms), hol = holidayOn(t.iso);
  const lines = ['## Market sessions', `-# Now: ${ts(ms, 'F')} — Discord shows every time below in your own time zone.`];
  for (const s of SESSIONS) {
    const w = sessionWindow(s, ms);
    const when = w.now ? `🟢 **Open** — closes ${ts(w.close, 't')} (${ts(w.close, 'R')})` : `⚪ Opens ${ts(w.open, 'f')} (${ts(w.open, 'R')})`;
    lines.push(`${s.icon} **${s.name}** · ${hm12(s.open)} – ${hm12(s.close)} ET${s.note ? ' — ' + s.note : ''}\n${when}`);
  }
  if (hol && t.dow >= 1 && t.dow <= 5) lines.push(`🏖 **${hol}** — no regular New York session today.`);
  lines.push('-# Futures close Friday 5 PM ET and reopen Sunday 6 PM ET, with a daily break 5–6 PM ET.');
  return lines.join('\n');
}

// ─── The trading day, posted by the cron trigger ─────────────────────────────────────────────────────
const PRINCIPLES = [
  'Never enter without displacement.',
  'Always trade in the direction of higher-timeframe bias.',
  'Let price come to your zone — never chase.',
  'Secure profits at 1:2 RR, trail the remainder if the market keeps pushing.',
  'Two trades max per day — patience pays.',
  'Never move your stop loss against you — ever.',
  'Discipline protects profits better than analysis does.',
  'Never let emotion write your next trade.',
  "Losses are tuition — they're what you pay to learn the craft.",
  'Consistency comes first. Size comes later.',
  "You don't need 10 trades a day — you need one good trade executed properly.",
  'Protect capital first, profits second.',
  'Your product is your discipline. Your income comes from your patience.',
  'Walk away when the job is done — being disciplined is the win.',
  'Plan first → wait for confirmation → execute with discipline.'
];
// One principle a day, the same for everyone that day.
function principleFor(ms) { const t = etParts(ms); return PRINCIPLES[Math.floor(Date.UTC(t.y, t.mo - 1, t.d) / 864e5) % PRINCIPLES.length]; }

// What the bot posts at this moment (cron fires every 30 minutes; most moments post nothing).
function duePosts(ms) {
  const t = etParts(ms), at = t.h * 60 + t.mi, weekday = t.dow >= 1 && t.dow <= 5, hol = holidayOn(t.iso), out = [];
  if (weekday && at === 8 * 60) {
    if (hol) out.push({ channel: 'premarket-dtc', content: `🏖 **${hol} — no regular New York session today.**\nGood day to sharpen the saw: read a chapter from {#01-trading-basics}, replay a past day in the tracker's Replay ({tracker}), or look back through your journal.` });
    else {
      const open = etToUtc(t.y, t.mo, t.d, 9, 30);
      out.push({ channel: 'premarket-dtc', content: [
        `☀️ **Pre-market — DTC time.** New York opens ${ts(open, 't')} (${ts(open, 'R')}).`,
        t.dow === 1 ? "**New week:** mark last week's high and low first." : null,
        '**Mark:** weekly high/low · PDH / PDL · Tokyo and London highs/lows · the 6 AM 4H candle and the 10 AM 4H open · 4H / 1H / 15m FVGs and order blocks · where the liquidity sits.',
        '**Check the news:** skip 15 minutes before and after high-impact releases (CPI, FOMC…).',
        '**Set your day:** daily goal, max loss, two trades max — post it in {#accountability}.',
        'Post your levels and bias below 👇 · {/dtc} for your checklist',
        `> Today's principle: *${principleFor(ms)}*`
      ].filter(Boolean).join('\n') });
    }
  }
  if (weekday && !hol && at === 9 * 60 + 30) {
    const close = etToUtc(t.y, t.mo, t.d, 9, 35);
    out.push({ channel: 'ny-session', ping: 'alerts', content: `🔔 {@alerts} **New York is open.** Mark the high and low of the first 5-minute candle — it closes ${ts(close, 't')}.\nThen drop to the 1-minute and wait for **displacement** out of the range — the **FVG** it leaves is your entry zone. Higher-timeframe bias only. Never chase. Two trades max.` });
  }
  if (weekday && !hol && at === 12 * 60) {
    out.push({ channel: 'ny-session', content: "🕛 **The 9:30–12:00 window is done.** Hit your goal or your max loss? You're done for the day. Still flat? No trade is a position too — patience pays." });
  }
  if (weekday && !hol && at === 15 * 60) {
    out.push({ channel: 'daily-recaps', content: '🛑 **Hard stop — 2:00 PM CT / 3:00 PM ET.** Close the charts.\nLog the day in the tracker → Core ({tracker}), then post a {/recap} here and a {/journal} in {#trade-journal}. Grade yourself on discipline, not P&L.' });
  }
  if (t.dow === 0 && at === 18 * 60) {
    out.push({ channel: 'weekly-review', content: "🗓 **Weekly review** — futures reopen now. Before Monday:\n**1.** Tracker → **Intel → Weekly Review**: week net, best and worst day, rule breaks, Coach Co's one fix.\n**2.** Post it here: what worked, what didn't, and the one thing you'll do differently.\n**3.** Mark **last week's high and low** for Monday's DTC." });
  }
  return out;
}

// ─── Discord REST ────────────────────────────────────────────────────────────────────────────────────
class RateLimited extends Error { constructor(ms) { super('rate limited'); this.ms = ms; } }
class OutOfBudget extends Error {}
class DiscordError extends Error { constructor(status, body) { super((body && body.message) || 'HTTP ' + status); this.status = status; this.code = body && body.code; } }

// Every call counts against `budget`: a Worker on the free plan may make 50 outbound requests per run.
function discord(env, budget = Infinity) {
  let used = 0;
  const api = async (method, path, body) => {
    if (used >= budget) throw new OutOfBudget();
    used++;
    const r = await fetch(API + path, {
      method,
      headers: Object.assign({ Authorization: 'Bot ' + env.DISCORD_TOKEN, 'User-Agent': 'DiscordBot (https://github.com/SaintJalon/combine-tracker, 1)' }, body === undefined ? {} : { 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (r.status === 429) throw new RateLimited(Math.ceil(((j && j.retry_after) || 2) * 1000) + 250);
    if (!r.ok) throw new DiscordError(r.status, j);
    return j;
  };
  api.used = () => used;
  return api;
}

function explain(e) {
  if (e instanceof DiscordError) {
    if (e.status === 401) return 'Discord rejected the bot token — copy a fresh one from the Developer Portal (Bot → Reset Token) into DISCORD_TOKEN.';
    if (e.code === 10004 || e.code === 50001) return "The bot isn't in that server — add it with the link in step 2, and check GUILD_ID.";
    if (e.code === 50013) return "The bot is missing a permission — add it again with the link in step 2 and keep every permission ticked.";
    return 'Discord said: ' + e.message;
  }
  return e.message || String(e);
}

const readOnlyOverwrites = (guildId, botId) => [
  { id: guildId, type: 0, deny: String(PERM.send) }, // @everyone's role id is the server's id
  { id: botId, type: 1, allow: String(PERM.view | PERM.send | PERM.embed | PERM.history) }
];

// ─── Setup ───────────────────────────────────────────────────────────────────────────────────────────
// Builds whatever is missing, in order: slash commands, roles, categories, channels, posts, an invite.
// It reads the server first and goes by name, so it's safe to stop and run again — a run that hits its
// request budget or a rate limit returns, and the next run carries on where it left off.
// Returns {done, log, invite?, wait?, error?}.
async function runSetup(env, { round = 0, budget = 45 } = {}) {
  const log = [];
  const missing = ['DISCORD_TOKEN', 'DISCORD_APP_ID', 'GUILD_ID'].filter((k) => !env[k]);
  if (missing.length) return { done: false, log, error: 'Set ' + missing.join(', ') + ' on the worker first.' };
  const api = discord(env, budget), g = env.GUILD_ID;
  try {
    let commands;
    if (round === 0) {
      commands = await api('PUT', `/applications/${env.DISCORD_APP_ID}/guilds/${g}/commands`, COMMANDS);
      log.push('Slash commands: ' + COMMANDS.map((c) => '/' + c.name).join(' '));
    }
    const me = await api('GET', '/users/@me');

    const roles = await api('GET', `/guilds/${g}/roles`);
    for (const r of ROLES) {
      if (roles.some((x) => x.name === r.name)) continue;
      roles.push(await api('POST', `/guilds/${g}/roles`, { name: r.name, color: r.color || 0, hoist: !!r.hoist, mentionable: !!r.mentionable, permissions: '0' }));
      log.push('Role: ' + r.name);
    }

    const chans = await api('GET', `/guilds/${g}/channels`);
    const find = (name, type) => chans.find((c) => c.name === name && c.type === type);
    for (const cat of CATEGORIES) {
      let parent = find(cat.name, 4);
      if (!parent) { parent = await api('POST', `/guilds/${g}/channels`, { name: cat.name, type: 4 }); chans.push(parent); log.push('Category: ' + cat.name); }
      for (const ch of cat.channels) {
        const type = ch.voice ? 2 : 0, have = find(ch.name, type);
        if (have) {
          // A new server's own #general sits in "Text Channels" — tidy it into place; anything you've
          // moved into a category of your own stays where you put it.
          const p = have.parent_id && chans.find((c) => c.id === have.parent_id);
          if (have.parent_id !== parent.id && (!p || /^(text|voice) channels$/i.test(p.name))) {
            await api('PATCH', `/channels/${have.id}`, { parent_id: parent.id });
            have.parent_id = parent.id;
            log.push(`Moved ${ch.voice ? '' : '#'}${ch.name} into ${cat.name}`);
          }
          continue;
        }
        const body = { name: ch.name, type, parent_id: parent.id };
        if (ch.topic) body.topic = ch.topic;
        if (ch.readOnly) body.permission_overwrites = readOnlyOverwrites(g, me.id);
        chans.push(await api('POST', `/guilds/${g}/channels`, body));
        log.push(ch.voice ? 'Voice: ' + ch.name : '#' + ch.name);
      }
    }

    if (!commands) commands = await api('GET', `/applications/${env.DISCORD_APP_ID}/guilds/${g}/commands`);
    const ctx = linkContext(env, chans, roles, commands);
    for (const ch of CATEGORIES.flatMap((c) => c.channels)) {
      if (!ch.posts) continue;
      const c = find(ch.name, 0);
      const want = channelMessages(ch, ctx);
      // Count what the bot already posted here; post the rest, in order.
      const have = (await api('GET', `/channels/${c.id}/messages?limit=50`)).filter((m) => m.author && m.author.id === me.id).length;
      for (let i = have; i < want.length; i++) {
        await api('POST', `/channels/${c.id}/messages`, want[i]);
        log.push(`Posted #${ch.name} ${i + 1}/${want.length}`);
      }
    }

    // unique:false hands back the same never-expiring invite on every run
    const inv = await api('POST', `/channels/${find('welcome', 0).id}/invites`, { max_age: 0, max_uses: 0, unique: false });
    return { done: true, log, invite: 'https://discord.gg/' + inv.code };
  } catch (e) {
    if (e instanceof OutOfBudget) return { done: false, log };
    if (e instanceof RateLimited) return { done: false, log, wait: e.ms };
    return { done: false, log, error: explain(e) };
  }
}

function linkContext(env, chans, roles, commands) {
  const ctx = { channels: {}, roles: {}, commands: {}, tracker: env.TRACKER_URL || TRACKER };
  for (const c of chans) if (c.type === 0 && !ctx.channels[c.name]) ctx.channels[c.name] = c.id;
  for (const r of ROLES) { const x = roles.find((y) => y.name === r.name); if (x) ctx.roles[r.key] = x.id; }
  for (const c of commands || []) ctx.commands[c.name] = c.id;
  return ctx;
}

async function runScheduled(env, ms) {
  const posts = duePosts(ms);
  if (!posts.length || !env.DISCORD_TOKEN || !env.GUILD_ID) return [];
  const api = discord(env, 45), g = env.GUILD_ID, sent = [];
  const chans = await api('GET', `/guilds/${g}/channels`);
  const roles = posts.some((p) => p.ping) ? await api('GET', `/guilds/${g}/roles`) : [];
  const commands = env.DISCORD_APP_ID ? await api('GET', `/applications/${env.DISCORD_APP_ID}/guilds/${g}/commands`).catch(() => []) : [];
  const ctx = linkContext(env, chans, roles, commands);
  for (const p of posts) {
    const id = ctx.channels[p.channel];
    if (!id) continue;
    const ping = p.ping && ctx.roles[p.ping];
    await api('POST', `/channels/${id}/messages`, { content: render(p.content, ctx), allowed_mentions: ping ? { roles: [ping] } : { parse: [] } });
    sent.push(p.channel);
  }
  return sent;
}

// ─── Slash commands ──────────────────────────────────────────────────────────────────────────────────
const SHARE = { type: 5, name: 'share', description: 'Post it in the channel for everyone (default: only you see it)' };
const MARKETS = {
  NQ: { name: 'Nasdaq', pv: 20, micro: 'MNQ', stop: 20 },
  MNQ: { name: 'Micro Nasdaq', pv: 2, stop: 20 },
  ES: { name: 'S&P 500', pv: 50, micro: 'MES' },
  MES: { name: 'Micro S&P', pv: 5 },
  GC: { name: 'Gold', pv: 100, micro: 'MGC' },
  MGC: { name: 'Micro Gold', pv: 10 },
  CL: { name: 'Crude Oil', pv: 1000, micro: 'MCL' },
  MCL: { name: 'Micro Crude', pv: 100 }
};
const MINDSET = {
  win: ['After a win', "**Greed** is the trap after a win — you want more.\n**Close the charts, take your profit, and walk away.** The job's done. Up $550 on a $600 goal? You don't need to chase the last $50 — being disciplined *is the win.*"],
  loss: ['After a loss', "**Fear** is the trap after a loss — you hesitate, or force a revenge trade.\n**Review what happened, reset your mindset, and stick to the plan.** Find *why*: was it a bad setup or a rule break? Losses are tuition — they're what you pay to learn the craft.\n**Never let emotion write your next trade.**"],
  streak: ['Losing days or weeks', "You'll have losing days — even losing weeks. That's normal. What matters is how you respond:\n1. Review, don't react\n2. Look at your screenshots and notes\n3. Find *why* you lost — bad setup or rule break?\n4. Adjust and move on\nEvery professional went through the same process. The difference is they didn't quit when it got uncomfortable."],
  doubt: ['Doubting my system', "**Doubt** — questioning your system after one bad day — is part of the cycle. One day isn't the system.\nGo back to your screenshots and journal: did you follow the DTC and the model? If you did, the plan worked even if the trade didn't.\nStick to your structure. Trust your model. Respect your risk."],
  ego: ['On a hot streak', "**Ego** — you think you've \"figured it out,\" then stop following rules. It shows up after the good days.\nThe numbers can get bigger, but the process never changes: 0.5% risk, two trades max, only setups that meet your rules.\n*Consistency comes first. Size comes later.*"],
  goal: ['My daily goal', "Set a clear, realistic target each day — for process, not just profit.\n*Example: daily profit goal **$600** · max daily loss **$500** · stop trading once either is hit.*\nThis keeps you consistent and emotionally neutral. Walk away — being disciplined *is the win.*"],
  control: ['The circle of control', `${F}\nWhat you CAN control     What you CAN'T control\nYour risk per trade      If the trade wins or loses\nYour entry timing        How far price moves\nYour discipline          Market volatility\nYour emotions            News events\n${F}\nThe more you focus on what you **can** control, the less stress you'll feel and the more consistent you'll become.`],
  funded: ['The funded mindset', "With a funded account the goal is survival and consistency — you're managing *someone else's capital*, so every rule matters.\n**Longevity over luck · Process over prediction · Execution over excitement.**\nTrading is a business, not a thrill. Your product is your discipline. Your income comes from your patience."]
};

const COMMANDS = [
  { name: 'dtc', description: 'Your Daily Trade Checklist — tick off the 11 steps before the open', options: [SHARE] },
  { name: 'md', description: 'The MD Model: 9:30 range, displacement, FVG entry, stop, target, rules', options: [SHARE] },
  { name: 'risk', description: 'Size a trade with the 0.5% rule', options: [
    { type: 4, name: 'account', description: 'Account size in dollars, e.g. 50000', required: true, min_value: 1000, max_value: 10000000 },
    { type: 3, name: 'market', description: 'What you trade (default NQ)', choices: Object.keys(MARKETS).map((k) => ({ name: `${k} — ${MARKETS[k].name}`, value: k })) },
    { type: 10, name: 'stop', description: "Stop in points (default 20 on Nasdaq — the guide's fixed stop)", min_value: 0.01, max_value: 10000 },
    { type: 10, name: 'risk_percent', description: 'Risk per trade in % (default 0.5)', min_value: 0.05, max_value: 5 },
    SHARE
  ] },
  { name: 'sessions', description: "What's open now — Tokyo, London, New York — in your time zone", options: [SHARE] },
  { name: 'glossary', description: 'Look up a term from the guide', options: [{ type: 3, name: 'term', description: 'e.g. FVG, order block, displacement', required: true, autocomplete: true }, SHARE] },
  { name: 'mindset', description: "A reset from the guide's psychology chapter", options: [
    { type: 3, name: 'topic', description: 'What you need right now', choices: Object.keys(MINDSET).map((k) => ({ name: MINDSET[k][0], value: k })) },
    SHARE
  ] },
  { name: 'recap', description: 'Post your day: P&L, trades, and did you follow your plan' },
  { name: 'journal', description: 'Journal today — what you saw, why you took it, did you follow your plan' },
  { name: 'intro', description: 'Introduce yourself to the community' },
  { name: 'tracker', description: 'The free Combine Tracker and the daily routine', options: [SHARE] }
];

const reply = (content, priv, extra) => ({ type: 4, data: Object.assign({ content, flags: priv ? 64 : 0, allowed_mentions: { parse: [] } }, extra || {}) });
const optionsOf = (i) => Object.fromEntries(((i.data && i.data.options) || []).map((o) => [o.name, o.value]));
const userOf = (i) => (i.member && i.member.user) || i.user || {};
const nameOf = (u) => u.global_name || u.username || 'Trader';
function avatarOf(u) {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
  return `https://cdn.discordapp.com/embed/avatars/${u.id ? Number((BigInt(u.id) >> 22n) % 6n) : 0}.png`;
}
const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pts = (n) => String(Math.round(n * 100) / 100);
const trackerButton = (env) => ({ type: 1, components: [{ type: 2, style: 5, label: 'Open the tracker', url: (env && env.TRACKER_URL) || TRACKER }] });

// Daily Trade Checklist: [button label, step, why]
const DTC = [
  ['Weekly H/L', 'Weekly high & low', "last week's levels act like magnets"],
  ['PDH / PDL', 'Previous day high & low', 'your first major liquidity zones'],
  ['Sessions', 'Session highs & lows', 'Tokyo, London, New York'],
  ['4H + FVGs', '4-hour range & FVGs', '6 AM candle, 10 AM open — premium or discount?'],
  ['1H', '1-hour FVGs & order blocks', 'refine your areas of interest'],
  ['15m', '15-minute FVGs & manipulation clues', 'line them up with the higher timeframes'],
  ['OBs + liquidity', 'Order blocks & liquidity', 'equal highs/lows, clean trendlines'],
  ['Manipulation', 'Wait for manipulation', 'a stop-hunt or fakeout at your zone'],
  ['Confirm', 'Confirm before entering', 'key level? MSS? displacement? volume?'],
  ['Execute', 'Execute & manage', '0.5% risk · 1:4 · breakeven at 1:2'],
  ['Review', 'Post-trade review', 'why in, how managed, how it ended + a screenshot']
];
// The checklist message; `done` = the step numbers ticked so far. Buttons carry the owner's id, so on a
// shared checklist only its owner can tick it.
function dtcMessage(done, uid) {
  const n = done.size, all = n === DTC.length;
  const lines = [`**Daily Trade Checklist** · ${n}/${DTC.length}`];
  DTC.forEach(([, step, why], k) => lines.push(`${done.has(k + 1) ? '✅' : '⬜'} **${k + 1}.** ${step} — ${why}`));
  lines.push(all ? "\n✅ **Checklist done.** You're prepared — now let price come to your zone." : '-# Plan first → wait for confirmation → execute with discipline.');
  const btn = (k) => ({ type: 2, style: done.has(k) ? 3 : 2, label: `${k} ${DTC[k - 1][0]}`, custom_id: `dtc:${k}:${uid}` });
  const rows = [];
  for (let k = 1; k <= DTC.length; k += 5) rows.push({ type: 1, components: Array.from({ length: Math.min(5, DTC.length - k + 1) }, (_, j) => btn(k + j)) });
  rows[rows.length - 1].components.push({ type: 2, style: 4, label: 'Reset', custom_id: `dtc:reset:${uid}` });
  return { content: lines.join('\n'), components: rows };
}

const MD_TEXT = `## The MD Model
**1 · Opening range** — at 9:30 AM ET, mark the high and low of the first 5-minute candle.
**2 · Displacement** — on the 1-minute, wait for a large-bodied candle that breaks the range with force.
**3 · Fair Value Gap** — the gap it leaves is your entry zone. Wait for price to pull back into it.
**4 · Entry** — aggressive: as price re-enters the FVG · conservative: a rejection wick, an engulfing candle, or an MSS.
**5 · Stop** — fixed 20 points (Nasdaq), or beyond the displacement candle.
**6 · Target** — fixed 50 points (Nasdaq), or structure (preferred): PDH for longs, PDL for shorts, the session high/low, the next unfilled FVG.
**7 · Filters** — trade with the 1H/4H bias · skip 15 minutes either side of high-impact news · prefer setups after a liquidity sweep · two trades a day, max.
**8 · Manage** — breakeven halfway to TP · take partials, trail the rest · exit early if structure breaks against you.
> Never enter without displacement. Let price come to your zone — never chase. Two trades max — patience pays.
-# The full chapter: #04-the-md-model`;

function riskPlan({ account, market = 'NQ', stop, risk_percent = 0.5 }) {
  const m = MARKETS[market];
  if (!m) return { error: 'Pick a market from the list.' };
  if (stop == null) stop = m.stop;
  if (stop == null) return { error: `Add your stop in points for ${market} — the guide's 20-point fixed stop is for Nasdaq.` };
  const risk = Math.round(account * risk_percent) / 100, per = stop * m.pv, n = Math.floor(risk / per + 1e-9);
  const lines = [
    `**Risk plan · ${money(account)} account**`,
    `Risk a trade (${risk_percent}%): **${money(risk)}** · two trades max = **${money(risk * 2)}** for the day`,
    `Stop **${pts(stop)} pts** on ${market} = **${money(per)}** a contract`
  ];
  let size = n, sym = market;
  if (n >= 1) lines.push(`→ **${n} ${market}** — ${money(n * per)} at risk`);
  else {
    const mic = m.micro && MARKETS[m.micro], perM = mic ? stop * mic.pv : 0, nM = mic ? Math.floor(risk / perM + 1e-9) : 0;
    if (nM >= 1) { size = nM; sym = m.micro; lines.push(`→ 1 ${market} would risk ${money(per)} — over your ${money(risk)}. Size down to **${nM} ${m.micro}** — ${money(nM * perM)} at risk`); }
    else lines.push(`→ Even 1 ${mic ? m.micro : market} risks ${money(mic ? perM : per)} — over your ${money(risk)}. Tighten the stop or skip the trade.`);
  }
  lines.push(`Target at 1:4 → **${pts(stop * 4)} pts** · stop to breakeven at 1:2 → **${pts(stop * 2)} pts**`);
  lines.push('-# Never move your stop loss against you — ever.');
  return { risk, per, size, sym, text: lines.join('\n') };
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// Every way to name a term: "Fair Value Gap (FVG)" → fair value gap, fvg; "Liquidity Grab / Stop Hunt" → both halves.
const termKeys = (t) => [t, t.replace(/\s*\(.*\)/, ''), ...((t.match(/\(([^)]*)\)/) || [])[1] || '').split(/\s+or\s+/), ...t.replace(/\s*\(.*\)/, '').split(' / ')].map(norm).filter(Boolean);
function lookup(q) {
  const k = norm(q);
  if (!k) return { matches: [] };
  const exact = GLOSSARY.find(([t]) => termKeys(t).includes(k));
  if (exact) return { term: exact };
  return { matches: GLOSSARY.filter(([t, d]) => termKeys(t).some((x) => x.includes(k)) || norm(d).includes(k)) };
}
function glossaryChoices(q) {
  const k = norm(q);
  const list = k ? GLOSSARY.filter(([t]) => termKeys(t).some((x) => x.includes(k))) : GLOSSARY;
  return list.slice(0, 25).map(([t]) => ({ name: t, value: t }));
}

function command(i, env) {
  const o = optionsOf(i), priv = !o.share, name = i.data.name;
  if (name === 'dtc') return { type: 4, data: Object.assign({ flags: priv ? 64 : 0, allowed_mentions: { parse: [] } }, dtcMessage(new Set(), userOf(i).id)) };
  if (name === 'md') return reply(MD_TEXT, priv);
  if (name === 'risk') { const p = riskPlan(o); return p.error ? reply(p.error, true) : reply(p.text, priv); }
  if (name === 'sessions') return reply(sessionsText(Date.now()), priv);
  if (name === 'glossary') {
    const r = lookup(o.term);
    if (r.term) return reply(`**${r.term[0]}** — ${r.term[1]}`, priv);
    if (r.matches.length === 1) return reply(`**${r.matches[0][0]}** — ${r.matches[0][1]}`, priv);
    if (r.matches.length) return reply(`A few terms match "${o.term}":\n` + r.matches.slice(0, 8).map(([t]) => '• ' + t).join('\n'), true);
    return reply(`"${o.term}" isn't in the guide's glossary. Start typing and pick from the list — or ask in #guide-questions.`, true);
  }
  if (name === 'mindset') {
    const m = MINDSET[o.topic];
    if (m) return reply(`### ${m[0]}\n${m[1]}`, priv);
    return reply(`### Today's principle\n> *${principleFor(Date.now())}*\n**After a win:** close the charts, take your profit, and walk away.\n**After a loss:** review what happened, reset your mindset, and stick to the plan.\n-# Pick a topic for more: after a win, after a loss, losing streaks, doubt, ego, your daily goal, the circle of control, the funded mindset.`, priv);
  }
  if (name === 'tracker') return reply("## 📈 Combine Tracker — free\nDaily targets for your evaluation, consistency checks, Coach Co's execution grade, a journal and Replay — in your browser, no sign-up.\n**Daily routine:** at the 2:00 PM CT / 3:00 PM ET hard stop, open it → **Core** → tap the day → net P&L → Save. Then post a /recap and a /journal here.\n**Weekend:** **Intel → Weekly Review**, and share Coach Co's one fix in #weekly-review.", priv, { components: [trackerButton(env)] });
  if (name === 'recap') return modal('recap', 'Day recap', [
    input('account', 'Account (optional)', 1, { required: false, placeholder: 'TopStep 50K', max: 60 }),
    input('pnl', 'Net P&L', 1, { placeholder: '450 or -250', max: 20 }),
    input('trades', 'Trades taken', 1, { placeholder: '2', max: 3 }),
    input('plan', 'Followed my plan? (yes / no)', 1, { placeholder: 'yes', max: 5 }),
    input('note', "Note — what worked, what didn't", 2, { required: false, max: 800 })
  ]);
  if (name === 'journal') return modal('journal', 'Trade journal', [
    input('before', 'Before the open — mood & sleep', 1, { required: false, placeholder: 'Calm, 7h sleep', max: 100 }),
    input('plan', 'My plan · I only trade if…', 2, { required: false, max: 500 }),
    input('day', 'What went well · what went wrong', 2, { max: 800 }),
    input('lesson', 'Lesson · one thing for tomorrow', 2, { required: false, max: 500 }),
    input('discipline', 'Discipline today (1–5)', 1, { placeholder: '4', max: 1 })
  ]);
  if (name === 'intro') return modal('intro', 'Introduce yourself', [
    input('trade', 'What do you trade?', 1, { placeholder: 'NQ, Gold…', max: 100 }),
    input('stage', 'Where are you right now?', 1, { placeholder: 'Learning, in an evaluation, funded…', max: 100 }),
    input('session', 'Your session / time zone', 1, { required: false, placeholder: 'New York · Central', max: 100 }),
    input('goal', 'One goal for this month', 2, { max: 300 }),
    input('more', 'Anything else?', 2, { required: false, max: 500 })
  ]);
  return reply("I don't know that command.", true);
}

const input = (custom_id, label, style, o = {}) => Object.assign({ type: 4, custom_id, label, style, required: o.required !== false, max_length: o.max }, o.placeholder ? { placeholder: o.placeholder } : {});
const modal = (custom_id, title, inputs) => ({ type: 9, data: { custom_id, title, components: inputs.map((t) => ({ type: 1, components: [t] })) } });
// Text input values from a modal — in action rows, or in the newer label components.
function valuesOf(components, out = {}) {
  for (const c of components || []) {
    if (c.custom_id && typeof c.value === 'string') out[c.custom_id] = c.value.trim();
    if (c.components) valuesOf(c.components, out);
    if (c.component) valuesOf([c.component], out);
  }
  return out;
}

function recapCoach(pnl, plan, trades) {
  const out = [];
  if (trades > 2) out.push('Over the two-trade max — discipline over frequency.');
  if (plan && trades === 0) out.push('No setup, no trade — patience pays.');
  else if (plan && pnl > 0) out.push('Close the charts, take your profit, and walk away.');
  else if (plan) out.push('You followed the plan on a red day — that *is* the job. Losses are tuition.');
  else if (pnl > 0) out.push("Green, but off-plan — that's how ego starts. Size and rules don't change on good days.");
  else out.push("Review, don't react: was it a bad setup or a rule break? Reset and stick to the plan.");
  return out.join('\n');
}

function modalSubmit(i, env) {
  const v = valuesOf(i.data.components), u = userOf(i), author = { name: nameOf(u), icon_url: avatarOf(u) };
  const day = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  const post = (embed, components) => ({ type: 4, data: { embeds: [embed], allowed_mentions: { parse: [] }, components } });
  if (i.data.custom_id === 'recap') {
    const pnl = Number(String(v.pnl).replace(/[$,\s]/g, '')), trades = Number(v.trades), yn = String(v.plan).toLowerCase();
    const plan = /^(y|yes|yeah|yep|✓|✅|true)$/.test(yn) ? true : /^(n|no|nope|✗|❌|false)$/.test(yn) ? false : null;
    const bad = [];
    if (!Number.isFinite(pnl) || v.pnl === '') bad.push(`P&L "${v.pnl}" — use a number like 450 or -250`);
    if (!Number.isInteger(trades) || trades < 0 || v.trades === '') bad.push(`trades "${v.trades}" — use a whole number`);
    if (plan === null) bad.push(`followed plan "${v.plan}" — answer yes or no`);
    if (bad.length) return reply("Couldn't post that recap: " + bad.join('; ') + '.' + (v.note ? '\nYour note, so you don\'t lose it:\n> ' + v.note.replace(/\n/g, '\n> ') : ''), true);
    const fields = [];
    if (v.note) fields.push({ name: 'Note', value: v.note });
    fields.push({ name: 'From the guide', value: recapCoach(pnl, plan, trades) });
    return post({
      author, title: `Day recap · ${day}`, color: pnl > 0 ? 0x2ecc71 : pnl < 0 ? 0xe74c3c : 0x95a5a6,
      description: [`**${pnl > 0 ? '+' : ''}${money(pnl)}** · ${trades} trade${trades === 1 ? '' : 's'} · ${plan ? '✅ followed my plan' : '❌ off plan'}`, v.account ? v.account : null].filter(Boolean).join('\n'),
      fields
    }, [trackerButton(env)]);
  }
  if (i.data.custom_id === 'journal') {
    const d = Number(v.discipline);
    if (!Number.isInteger(d) || d < 1 || d > 5) return reply(`Discipline "${v.discipline}" — use a number from 1 to 5.\nWhat you wrote, so you don't lose it:\n> ${String(v.day).replace(/\n/g, '\n> ')}`, true);
    const fields = [['Before the open', v.before], ['My plan', v.plan], ['What went well · what went wrong', v.day], ['Lesson · tomorrow', v.lesson]].filter((f) => f[1]).map(([name, value]) => ({ name, value }));
    fields.push({ name: 'Discipline', value: `${'★'.repeat(d)}${'☆'.repeat(5 - d)} ${d}/5` + (d <= 2 ? "\n*Grading yourself honestly is the point. Find why — bad setup or rule break? — adjust, and move on.*" : d >= 4 ? '\n*Protect capital, follow the process, execute only when the rules line up — that\'s the job.*' : '') });
    return post({ author, title: `Trade journal · ${day}`, color: d >= 4 ? 0x2ecc71 : d === 3 ? 0xf1c40f : 0xe74c3c, fields });
  }
  if (i.data.custom_id === 'intro') {
    const fields = [['Trades', v.trade], ['Where they are', v.stage], ['Session', v.session], ['Goal this month', v.goal], ['More', v.more]].filter((f) => f[1]).map(([name, value]) => ({ name, value, inline: name === 'Trades' || name === 'Session' }));
    return post({ author, title: `👋 Say hi to ${nameOf(u)}`, color: 0x34c759, fields, footer: { text: 'New here too? Grab your roles and start the guide at #01-trading-basics.' } });
  }
  return reply("I don't know that form.", true);
}

async function component(i, env) {
  const id = i.data.custom_id || '', u = userOf(i);
  if (id.startsWith('dtc:')) {
    const [, step, owner] = id.split(':');
    if (owner && owner !== u.id) return reply('This is someone else\'s checklist — run /dtc for your own.', true);
    const done = new Set();
    if (step !== 'reset') {
      for (const row of (i.message && i.message.components) || []) for (const b of row.components || []) {
        const k = /^dtc:(\d+):/.exec(b.custom_id || '');
        if (k && b.style === 3) done.add(+k[1]);
      }
      done.has(+step) ? done.delete(+step) : done.add(+step);
    }
    return { type: 7, data: dtcMessage(done, owner || u.id) };
  }
  if (id.startsWith('role:')) {
    const r = roleByKey(id.slice(5));
    if (!r || !r.pick) return reply("That button isn't a role I hand out.", true);
    if (!i.guild_id || !i.member) return reply('Use this inside the server.', true);
    const api = discord(env, 5);
    try {
      const role = (await api('GET', `/guilds/${i.guild_id}/roles`)).find((x) => x.name === r.name);
      if (!role) return reply(`The ${r.name} role is gone — ask a mod to run the setup again.`, true);
      const has = (i.member.roles || []).includes(role.id);
      await api(has ? 'DELETE' : 'PUT', `/guilds/${i.guild_id}/members/${u.id}/roles/${role.id}`);
      return reply(has ? `Removed **${r.name}**.` : `Added **${r.emoji} ${r.name}**.` + (r.key === 'alerts' ? " You'll be pinged in #ny-session at 9:30 AM ET." : ''), true);
    } catch (e) {
      if (e instanceof DiscordError && e.code === 50013) return reply(`I can't hand out ${r.name} yet — a mod needs to drag my role above it in Server Settings → Roles.`, true);
      return reply("Couldn't change that role right now — try again in a minute.", true);
    }
  }
  return reply("That button doesn't do anything anymore.", true);
}

function autocomplete(i) {
  const focused = ((i.data && i.data.options) || []).find((o) => o.focused);
  return { type: 8, data: { choices: glossaryChoices(focused ? focused.value : '') } };
}

async function handleInteraction(i, env) {
  if (i.type === 1) return { type: 1 }; // Discord's ping when you save the endpoint URL
  if (i.type === 2) return command(i, env);
  if (i.type === 3) return component(i, env);
  if (i.type === 4) return autocomplete(i);
  if (i.type === 5) return modalSubmit(i, env);
  return reply("I don't know how to handle that yet.", true);
}

// Discord signs every request; anything unsigned or mis-signed gets a 401 (Discord tests this too).
async function verified(req, body, publicKey) {
  const sig = req.headers.get('X-Signature-Ed25519'), stamp = req.headers.get('X-Signature-Timestamp');
  if (!sig || !stamp || !publicKey || !/^[0-9a-f]+$/i.test(sig + publicKey)) return false;
  const bytes = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  const data = new TextEncoder().encode(stamp + body);
  for (const alg of [{ name: 'Ed25519' }, { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }]) {
    try {
      const key = await crypto.subtle.importKey('raw', bytes(publicKey), alg, false, ['verify']);
      return await crypto.subtle.verify(alg, key, bytes(sig), data);
    } catch (e) { /* older runtimes only know the NODE-ED25519 name */ }
  }
  return false;
}

// ─── The setup page ──────────────────────────────────────────────────────────────────────────────────
function sameKey(a, b) {
  a = String(a || ''); b = String(b || '');
  let x = a.length ^ b.length;
  for (let k = 0; k < Math.max(a.length, b.length); k++) x |= (a.charCodeAt(k) || 0) ^ (b.charCodeAt(k) || 0);
  return x === 0 && a.length > 0;
}

function setupPage(env, origin) {
  const app = /^\d+$/.test(env.DISCORD_APP_ID || '') ? env.DISCORD_APP_ID : '';
  const check = (k, what) => `<li class="${env[k] ? 'ok' : 'no'}">${env[k] ? '✓' : '✗'} <code>${k}</code> — ${what}</li>`;
  const invite = app ? `https://discord.com/oauth2/authorize?client_id=${app}&scope=bot%20applications.commands&permissions=${BOT_PERMISSIONS}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Server setup</title><style>
:root{color-scheme:dark;--bg:#0b0e0c;--card:#121714;--fg:#e6ede8;--mute:#8d9a91;--line:#223029;--accent:#34c759;--bad:#ff6b5b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:640px;margin:0 auto;padding:28px 16px 48px}h1{font-size:24px;margin:0 0 6px}h2{font-size:16px;margin:28px 0 8px}
p{margin:6px 0}.mute{color:var(--mute)}ul{list-style:none;padding:0;margin:8px 0}li{padding:3px 0}.ok{color:var(--accent)}.no{color:var(--bad)}
code{font:13px ui-monospace,Menlo,monospace;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1px 5px;word-break:break-all}
a{color:var(--accent)}form{display:flex;gap:8px;flex-wrap:wrap}input{flex:1;min-width:0;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:inherit}
button{padding:10px 16px;border-radius:8px;border:0;background:var(--accent);color:#04140a;font:600 15px system-ui,sans-serif;cursor:pointer}button:disabled{opacity:.5;cursor:default}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;max-height:320px;overflow:auto;white-space:pre-wrap;font:13px/1.5 ui-monospace,Menlo,monospace;margin:12px 0 0}
.done{border:1px solid var(--accent);border-radius:8px;padding:12px 14px;margin-top:14px}
</style></head><body><main>
<h1>Server setup</h1>
<p class="mute">Builds the community server: roles, channels, the whole guide chapter by chapter, and the slash commands. Safe to run again — it only adds what's missing and never edits or deletes anything.</p>
<h2>1 · Settings on this worker</h2>
<ul>${check('DISCORD_APP_ID', 'Application ID')}${check('DISCORD_PUBLIC_KEY', 'Public Key')}${check('DISCORD_TOKEN', 'bot token (secret)')}${check('GUILD_ID', 'your server\'s ID')}${check('SETUP_KEY', 'a password for this page (secret)')}</ul>
<p class="mute">Interactions Endpoint URL for the Developer Portal: <code>${origin}/interactions</code></p>
<h2>2 · Add the bot to your server</h2>
<p>${invite ? `<a href="${invite}" target="_blank" rel="noopener">Add the bot →</a> pick your server and keep every permission ticked.` : 'Set DISCORD_APP_ID first — then the link appears here.'}</p>
<h2>3 · Build</h2>
<form id="f"><input id="key" type="password" placeholder="Setup key" autocomplete="current-password" required><button id="go">Build the server</button></form>
<pre id="log" hidden></pre><div id="done" class="done" hidden></div>
<script>
const f=document.getElementById('f'),log=document.getElementById('log'),go=document.getElementById('go'),done=document.getElementById('done');
const say=(t)=>{log.hidden=false;log.textContent+=t+'\\n';log.scrollTop=log.scrollHeight;};
const wait=(ms)=>new Promise((r)=>setTimeout(r,ms));
f.onsubmit=async(e)=>{e.preventDefault();go.disabled=true;log.textContent='';done.hidden=true;
  try{for(let round=0;round<200;round++){
    const r=await fetch('/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:document.getElementById('key').value,round})});
    const j=await r.json().catch(()=>({error:'The worker answered '+r.status+'.'}));
    (j.log||[]).forEach(say);
    if(j.error){say('✗ '+j.error);break;}
    if(j.done){say('✓ Done.');done.hidden=false;done.textContent='';
      const a=document.createElement('a');a.href=j.invite;a.textContent=j.invite;a.target='_blank';
      done.append('Your server is ready. Invite people with ',a,' — and add the cron trigger (*/30 * * * *) so the daily posts run.');break;}
    if(j.wait){say('… Discord asked to slow down — waiting '+Math.ceil(j.wait/1000)+'s');await wait(j.wait);}
  }}catch(err){say('✗ '+err.message);}
  go.disabled=false;};
</script></main></body></html>`;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env = {}, ctx) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && path === '/') {
      const configured = Object.fromEntries(['DISCORD_APP_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_TOKEN', 'GUILD_ID', 'SETUP_KEY'].map((k) => [k, !!env[k]]));
      return json(200, { bot: 'simple-start', ok: true, configured });
    }
    if (path === '/setup' && req.method === 'GET') return new Response(setupPage(env, url.origin), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (path === '/setup' && req.method === 'POST') {
      if (!env.SETUP_KEY) return json(403, { error: 'Add a SETUP_KEY secret to the worker first — it is the password for this page.' });
      const b = await req.json().catch(() => ({}));
      if (!sameKey(b.key, env.SETUP_KEY)) return json(403, { error: "That isn't the setup key." });
      return json(200, await runSetup(env, { round: +b.round || 0 }));
    }
    if (req.method === 'POST' && (path === '/interactions' || path === '/')) {
      const body = await req.text();
      if (!(await verified(req, body, env.DISCORD_PUBLIC_KEY))) return new Response('Bad signature.', { status: 401 });
      let i;
      try { i = JSON.parse(body); } catch (e) { return new Response('Bad JSON.', { status: 400 }); }
      try { return json(200, await handleInteraction(i, env)); }
      catch (e) { return json(200, reply('Something went wrong on my side — try again in a minute.', true)); }
    }
    return json(404, { error: 'Not found.' });
  },
  async scheduled(controller, env, ctx) {
    const run = runScheduled(env, controller.scheduledTime);
    if (ctx && ctx.waitUntil) ctx.waitUntil(run); else await run;
  },
  // For discord/setup.mjs and the tests. They hang off the default export because Workers refuse a main
  // module that exports anything but handlers ("Incorrect type for map entry …").
  lib: {
    BOT_PERMISSIONS, ROLES, GLOSSARY, CATEGORIES, SESSIONS, PRINCIPLES, MARKETS, COMMANDS, DTC,
    render, channelMessages, etParts, etToUtc, holidayOn, sessionWindow, sessionsText, principleFor, duePosts,
    runSetup, runScheduled, dtcMessage, riskPlan, lookup, recapCoach, handleInteraction
  }
};
