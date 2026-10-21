# Discord community bot

A free Discord server where beginners learn and experienced traders connect, built on the guide
*Simple Start to Futures Trading* and the Combine Tracker. One Cloudflare Worker (free) runs the bot:
no server to keep on, no terminal needed.

## What you get
**The server, built for you** — 9 roles, 7 categories, 32 channels, and the whole guide posted chapter by chapter:

| Category | Channels |
|---|---|
| 📌 Start here | welcome · rules · pick-your-roles (buttons) · announcements · introductions |
| 📖 The Guide — free | 01-trading-basics · 02-futures-and-funding · 03-the-dtc · 04-the-md-model · 05-risk-and-mindset · 06-getting-started · 07-glossary · guide-questions |
| ☀️ Trading day | premarket-dtc · ny-session · setups · accountability |
| 📈 Track & review | tracker-how-to · daily-recaps · trade-journal · weekly-review · replay-sparring · tracker-help |
| 🧠 Mindset | psychology · wins-and-lessons |
| 💰 Funding | prop-firms-and-evals · payouts |
| 🤝 Connect | general · ask-a-trader · experienced-traders · 🔊 Trading Floor · 🔊 Study Hall |

The guide channels are read-only, so they stay clean, but anyone can react or open a thread on a post to ask about it.

**Roles** — members pick their own in #pick-your-roles: where they are (🌱 Learning · 📝 In Evaluation ·
💰 Funded · 🏆 Paid Out), what they trade (NQ & ES · Gold · Crude Oil), and 🔔 NY Open Alerts.
**Mentor** is yours to hand out to experienced traders who help others; anyone can @mention it in #ask-a-trader.

**Slash commands**
| Command | What it does |
|---|---|
| `/dtc` | The Daily Trade Checklist as 11 buttons to tick off before the open |
| `/md` | The MD Model on one card |
| `/risk` | Sizes a trade at 0.5%: contracts for your stop (micros when a mini is too big), the 1:4 target, breakeven at 1:2 |
| `/sessions` | Tokyo, London, New York and the 9:30–12:00 window: what's open, shown in each person's own time zone |
| `/glossary` | Any term from the guide, with autocomplete |
| `/mindset` | A reset from Chapter 10: after a win, after a loss, losing streaks, doubt, ego, the daily goal… |
| `/recap` | A form for the day (P&L, trades, followed the plan?) that posts a card with the guide's advice for that day |
| `/journal` | The tracker's journal questions as a form, posted as a card |
| `/intro` | Introduces a new member |
| `/tracker` | The tracker's link and daily routine |

The reference answers (`/dtc` `/md` `/risk` `/sessions` `/glossary` `/mindset` `/tracker`) are private unless you
set `share: True`, so channels don't fill up with cards. `/recap`, `/journal` and `/intro` post in the channel you use them in.

**The trading day, posted for you** (Eastern time, skipping US market holidays like the tracker does)
- **8:00 AM** #premarket-dtc: the DTC, the news check, the day's principle (Mondays: mark last week's high and low)
- **9:30 AM** #ny-session: New York is open (pings 🔔 NY Open Alerts): mark the opening range, wait for displacement
- **12:00 PM** #ny-session: the 9:30–12:00 window is done
- **3:00 PM** (2:00 PM CT, the tracker's hard stop) #daily-recaps: log the day, `/recap`, `/journal`
- **Sunday 6:00 PM** #weekly-review: the tracker's Weekly Review and last week's levels
On a market holiday, 8:00 AM posts a study-day note instead and the rest stay quiet.

---

## Set it up (about 15 minutes, no terminal)

### 1. Make the server
In Discord: **＋ (Add a Server) → Create My Own → For a club or community**, and name it.
Then turn on **User Settings → Advanced → Developer Mode**, right-click the server icon → **Copy Server ID**.
That's your `GUILD_ID`.

### 2. Make the bot
1. Go to **discord.com/developers/applications → New Application**. Its name is the bot's name (e.g. "Coach Co").
2. **General Information**: copy the **Application ID** (`DISCORD_APP_ID`) and **Public Key** (`DISCORD_PUBLIC_KEY`).
3. **Bot → Reset Token** → copy it (`DISCORD_TOKEN`). Keep it secret. No privileged intents are needed.
   Optional: to stop anyone else adding your bot to their own server, set **Installation → Install Link** to *None*, then turn off **Bot → Public Bot**.

### 3. Put the bot on Cloudflare
1. **dash.cloudflare.com → Workers & Pages → Create → Create Worker** (start from "Hello World"). Name it
   `simple-start-bot` → **Deploy**.
2. **Edit code**: delete everything, paste the whole of [`worker.mjs`](worker.mjs) → **Deploy**.
3. **Settings → Variables and Secrets → Add**:
   - Text: `DISCORD_APP_ID`, `GUILD_ID` (and `TRACKER_URL` only if your tracker isn't at `https://saintjalon.github.io/combine-tracker/`)
   - Secret: `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, and `SETUP_KEY` (a long password you make up; it protects the setup page)
4. **Settings → Triggers → Cron Triggers → Add**: `*/30 * * * *`. That's what runs the day's posts.
   The worker works out Eastern time itself, so daylight saving needs no change.

### 4. Connect Discord to the worker
Back in the Developer Portal → **General Information → Interactions Endpoint URL**:
`https://simple-start-bot.YOURNAME.workers.dev/interactions` → **Save Changes**.
Discord checks the address right away. If it won't save, re-check `DISCORD_PUBLIC_KEY` and that you deployed.

### 5. Build the server
Open `https://simple-start-bot.YOURNAME.workers.dev/setup`:
1. It shows which settings it sees (✓ / ✗).
2. **Add the bot →** picks your server with the right permissions. Keep them all ticked.
3. Type your `SETUP_KEY` → **Build the server**. It takes a minute or two while Discord paces it, and ends with your
   server's invite link.

**Afterwards:** give yourself (and trusted experienced traders) the **Mentor** role, and delete Discord's empty
"Text Channels" / "Voice Channels" categories if you like. Your server's own #general is moved into 🤝 Connect.

## Keeping a free server healthy
- **Server Settings → Safety Setup**: turn on AutoMod's spam and suspicious-link filters and set the verification
  level to *Medium*. Trading servers attract "DM me to grow your account" scammers. Rule 3 warns members, and a mod
  or two from your Mentors helps.
- **Server Settings → Enable Community** gives you an announcement channel people can follow, a rules screen, and
  server insights. Point it at #rules and #announcements.

## Changing it
Everything lives at the top of `worker.mjs`: the guide posts, `CATEGORIES` (channels, topics, which are read-only),
`ROLES`, the daily posts in `duePosts`, and the commands. Edit, paste it into the worker again, and run setup again.
Setup only **adds** what's missing and never edits or deletes. To change a post that's already up, delete the bot's
messages in that channel and run setup again; it reposts them. Renaming a channel in Discord means setup no longer
finds it and makes a new one, so rename it in `CATEGORIES` too.

## From a terminal instead
```bash
cd discord
npx wrangler deploy                      # uses wrangler.toml: the worker plus the cron trigger
npx wrangler secret put DISCORD_TOKEN    # and DISCORD_PUBLIC_KEY, SETUP_KEY; set the two vars in wrangler.toml
# build the server straight from your computer, without the /setup page:
DISCORD_TOKEN=… DISCORD_APP_ID=… GUILD_ID=… node setup.mjs
```

## Test it
`node tests/discord.test.mjs` (from the repo root) checks every post and command against Discord's limits, the signed
endpoint, the commands, the Eastern-time calendar and holidays, and setup against a stand-in server: it stays under the
free plan's request limit, a second run adds nothing, and a run interrupted by a rate limit picks up without double-posting.
