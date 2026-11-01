# SaintTrades RB Flow (key level → 5m RB → 1H RB)

`SaintTrades-RBFlow.pine` turns your model into buy and sell signals with an entry, a stop and a target:

> Price rejects a key level (above all the previous 4H high or low) with a **5-minute rejection block**, then runs to the nearest **1-hour rejection block** on the other side. The rejection blocks are exactly the ones your **JS RB** indicator draws.

It finds every setup on your chart's history, takes each one three ways (market at the RB close, body-edge limit, CE limit), and scores them. You get the answer from your own chart: does this make money, on which entry, at which levels, at what time of day, and day by day.

It never repaints: everything runs on closed bars, and a level or RB only counts after its candle has closed.

## The model

Your two screenshots, as rules:

| Screenshot | What happened | Rule |
|---|---|---|
| Oct 30, 10:00 | The 5m candle runs above the 4H high, closes back below with a long upper wick (the red **M5** box under "Prev 4H High"), and price falls 600 points | **Sweep:** a 5m RB whose wick reaches a key level while its body stays on the near side |
| Oct 30, 10:00 | That same 5m RB *is* the high of the 4H candle, so it sits at "Prev 4H High" afterwards | **4H RB:** the 5m RB that made a 4H candle's high or low, traded on the retest during the next 4H candle |
| Oct 29, 20:00 | M5 RBs on the way down, price heading for the white **H1** box below | **Target:** the nearest opposing 1H RB, one of JS RB's H1 boxes. Shorts run to a bullish 1H RB below, longs to a bearish 1H RB above |

**Rejection block** (both timeframes): JS RB's rule, copied from its code.
- Every swing high and swing low is liquidity: a candle whose high (low) is strictly beyond the candles on each side. With the default *Swing strength* = Sensitive, that's 1 candle each side.
- The first candle whose wick trades through a swing level takes it. If that candle's **body stays on the near side**, it is a rejection block.
- Zone = body edge to wick tip. CE = 50% of the wick.
- An RB lasts until a later wick trades **past its tip**. Touching it doesn't end it.
- No minimum wick size.

Checked against your JS RB code itself on 5,520 random 5m candles at every swing strength, with and without its direction filter: **0 differences** in about 2,000 RBs.

The 1H target boxes are built on the 1H chart's own full history, the same way JS RB builds its H1 boxes. So a 1H RB from weeks before your chart's first bar still counts, like your 27,150 box.

**Key levels:** by default only the **previous 4H high and low**. The others your KeyLevels indicator draws can each be turned on:
- previous 4H high/low
- previous day high/low
- daily, weekly, monthly, quarterly and yearly opens
- previous week and month high/low
- Monday high/low
- Asia high/low
- optionally London high/low and the previous week/month mids

Highs only count for shorts and lows only for longs. Opens and mids count both ways. Once a 5m candle **closes** beyond a high or low, that level is broken and stops counting. A level gives one signal per direction.

## A signal

| | Short (long is the mirror image) |
|---|---|
| **Entry** | **RB close (market):** the close of the 5m RB candle. **Body-edge limit:** the bottom of the wick zone. **CE limit:** 50% of the wick. **Confirmation close:** wait for a 5m candle to close back through the CISD level (the open of the run of candles that pushed into the RB), then enter at that close; cancelled if price trades through the stop first or no close comes within 6 candles. Pick one under *Entry shown & alerted*. The table measures all four. |
| **Stop** | 5m RB tip + 4 ticks (1 NQ point) |
| **Target** | The near edge (or CE, an input) of the nearest bullish 1H RB (a JS RB H1 box) below the entry that is at least **1.5R** away. No such 1H RB = no trade. *If no target RB is far enough* can instead fall back to the previous 4H low, then a fixed 3R; the breakdown scores each kind of target separately. |
| **Skipped if** | The stop is wider than **40 points** (input) |
| **Ends** | At the stop or the target. At **16:00 NY** anything still open closes at the bar's close and unfilled limits are cancelled. No new signals until the 18:00 open. |

On the chart each signal gets:
- its red/green **5m RB** box, with a **SELL** / **BUY** marker (hover it for setup, level, stop, target, R:R and contract count)
- TradingView-style green / red **TP / SL zones**
- three thick price lines with tags at the right:
  - blue **SELL 28,845.00** (the entry)
  - green **TP 28,300.00 +21.8R · 1H RB** (the target and what it is)
  - red **SL 28,863.00 −1R · 18.00 pts** (the stop and its size)
- the white **1H target** box when the target is a 1H RB

Pending limits are dashed (**SELL LIMIT …**) until they fill. When a trade ends, the tag it ended on shows **✓ HIT +21.8R** or **✗ HIT −1.0R**. A trade closed at 16:00 gets a "flattened" tag at its exit price.

A setup the shown entry couldn't trade (no target, or the stop wider than your max) is a grey **SELL ✕**. Hover it for the reason.

*Entry / TP / SL tags* show on the live trade only by default, so the chart stays readable. A finished trade keeps its faint TP / SL zones and a small result. Tags can also be shown on every trade or turned off. *Tag size* sets how big they are.

## Install

1. Pine Editor → paste `SaintTrades-RBFlow.pine` → **Save** → **Add to chart**.
2. Use **MNQ1! or NQ1!**. A 1-minute chart only loads about 10 days. A **5-minute chart gives exactly the same trades** and loads about 5× more days, so use it to judge the model and the 1m to trade. Defaults are your model: 5m entry RBs, 1H target RBs.
3. Load as much history as your plan allows (scroll left), then read the table.

After any code change, remove it from the chart and add it again.

## Confirming it over past days

This is how you and I check the model, one day at a time:

1. **Stats table → Days** lists the last 10 trading days: trades, wins–losses, net R. **Stats table → Breakdown** shows where the edge is (see below).
2. **Pine Logs** (the `{}` icon / "Pine Logs" in the editor) list **every** trade, one line each, oldest first:
   `2026-10-30 · SELL · Sweep of Prev 4H High · RB close (market) 28845.00 · SL 28863.00 · TP 28300.00 · +21.8R (full +21.8R, ½+BE +11.4R)`
3. **Scroll back day by day** with JS RB and KeyLevels on the same chart. Every signal and its result is drawn (the newest 40 by default; raise *Signals kept on the chart* to see more). For each one, ask:
   - Is that the 5m RB you would have taken?
   - Is the white box the 1H RB you would have targeted?

   Where the answer is no, tell me the date and time. That is how we tune the rules.

## Inputs

**1 · Setups**
| Input | Default | What it does |
|---|---|---|
| Sweep | on | 5m RB off a key level |
| 4H RB | off | The 5m RB that made the 4H high/low, traded on the retest |
| Entry / target RB timeframe | 5m / 1H | The chart timeframe must divide the entry timeframe |
| Direction | Both | Or longs / shorts only |
| While a trade is live | One at a time | A new signal is skipped while the shown entry's trade is pending or open. Or skip the same direction only, or take every signal. |
| Only shorts above / longs below the daily open | off | Premium / discount against the 18:00 open, judged on the 5m RB's CE |
| Only signal inside (NY) | off, 08:00–16:00 | A time window for new signals |

**2 · Key levels:** only **Previous 4H high / low** is on by default. Turn on the day, week, month, Monday, Asia and London levels and the opens to test them; the breakdown scores each group.

| Input | Default | What it does |
|---|---|---|
| Wick may stop short of a level by | 0 ticks | 0 = touch or trade through |
| One signal per level per direction | on | Stops repeat signals off the same level |

**3 · Rejection blocks (JS RB rules)** — set the first two the same as in JS RB:

| Input | Default | What it does |
|---|---|---|
| Swing strength | Sensitive | Sensitive = 1 candle each side, Normal = 2 left / 3 right, Strict = 6 |
| Only RBs closing in trade direction | off | Bullish RBs need a green close, bearish a red close |
| Target RBs from | Full history (like JS RB) | Or *Chart history*: only the bars loaded on the chart |

**4 · Entry, stop & target**
| Input | Default | What it does |
|---|---|---|
| Entry shown & alerted | RB close (market) | Body-edge limit and CE limit are the others. A 4H RB is only known at the 4H close, so its "market" entry is the body-edge limit. |
| Stop buffer | 4 ticks | Past the tip |
| TP at the target RB's | Near edge | Or its CE |
| Minimum R:R | 1.5 | A 1H RB closer than this isn't used as the target |
| If the nearest target RB is closer than that | Use the next one out | Or skip the trade |
| If no target RB is far enough | Skip the trade | Or the opposite 4H high/low then a fixed R, or straight to the fixed R |
| Fixed R target | 3R | |
| Max stop size | 40 points | Skip RBs with a wider stop. 0 = off. |
| Confirmation: 5m candles allowed | 6 | How long the confirmation close may take |
| Skip targets further than | off | In R. Far targets are rarely reached before the stop. |
| Sweep limits cancel after | 60 min | 4H RB limits cancel when the next 4H candle closes |
| TP1 for ½ + breakeven | 1R | Used by the managed result |
| Results use | Full to target | Or **½ at TP1 + breakeven**: half off at TP1, stop to entry, the rest to the 1H RB |
| Flatten & cancel at | 16:00 NY | Or 17:00 NY (close), or Never |
| Risk per trade ($) | off | Shows how many contracts fit your risk, in the label and alert |

## Reading the table

| Row | Meaning |
|---|---|
| Setups / Skipped / days | Signals found, setups the shown entry couldn't trade (grey ✕), trading days on the chart |
| **Entry rows** | For each entry: trades filled / trades with a valid target, **Hit 1H** = share that reached the 1H RB before the stop, **Avg R** and **Net R** with the whole position to the target, and **½ + BE** = average R and win % when managed |
| ▶ row | For the shown entry: max drawdown in R, longest losing run, share of green days, net R |
| **Breakdown** | The shown entry's trades split by setup, side, the level swept, the time of the signal (Asia, London, NY AM, NY PM), the kind of target, with/against the daily open, whether the RB candle closed with the trade, the target's distance (<5R, 5–10R, >10R) and the stop size (≤15 / >15 pts) |
| **Days** | The last 10 trading days |

### Making it more accurate

1. Set **Stats table → Breakdown** on a 5-minute chart with as many days as you can load.
2. Compare each row's **Avg R** with the ▶ row. A row that is clearly better on **about 100 trades or more** is a real filter. Smaller rows are mostly luck.
3. Turn that filter on (session window, direction, premium/discount, max target distance, max stop size, or JS RB's "only RBs closing in trade direction"), or switch the entry to the one with the best Avg R.
4. Check it on **different days** than you chose it on, by scrolling to an older stretch or waiting a couple of weeks. A filter that only works on the days you picked it from will fail live.

Judge it by **average R on at least ~100 trades**, not by win rate. A 1H target is often 4–10R away, so a 25% hit rate can still make money, and a 60% win rate can still lose. Then check it on a different date range than the one you tuned on.

## Alerts

Create an alert on the indicator with **"Any alert() function call"** to get the full message:

`SELL MNQZ2026 · Sweep of Prev 4H High`
`RB close (market) 28845.00  SL 28863.00  TP 28300.00  R:R 21.8`

You also get alerts when a limit fills and when a trade closes. There are also four plain alert conditions: BUY, SELL, limit filled, trade closed.

## What was checked

- **Syntax:** passes the `pynescript` parser.
- **Runs end to end in PineTS** (an open-source Pine v6 runtime) on 1m bars with no runtime errors. The runs covered:
  - every entry
  - both result modes
  - all three flatten options
  - all three "while a trade is live" options
  - 1m→15m, 5m→1H and 15m→4H timeframes
  - fixed-R fallback, "use the next one out" and max stop size
  - time window, London and mid levels, level tolerance
  - every drawing and table mode

  A 5m chart gives exactly the same trades as a 1m chart.
- **Same RBs as JS RB:** your JS RB `detect()` code, unchanged, ran next to this indicator's on 5,520 random 5m candles at Sensitive, Normal and Strict, with and without the direction filter: **0 differences** across about 2,000 rejection blocks.
- **Known-answer scenarios** (hand-calculated first, 37 checks, all pass). The 1H target is a bullish JS RB at 990–1012: the 19:00 hour wicks to 990 through the 16:00 swing low at 1002 and closes at 1014.

  | Scenario | Result |
  |---|---|
  | A 5m candle wicks to 1110 through the 1105 swing high (also the previous 4H high) and closes 1098 | SELL at 1098, SL 1111, TP 1012 → **+6.62R**; managed **+3.81R** |
  | Same, but the 1105 high isn't a strict swing high | Not a JS RB → no trade |
  | Same, body-edge limit | Filled at 1100 on the retrace → **+8.0R** |
  | Same, CE limit at 1105 | Price never came back that high → no trade |
  | TP at the 1H RB's CE (1001) | **+7.46R**. If price stops at 1005 instead, it is flattened at 16:00 for +7.15R. |
  | Minimum R:R 7 (the 1H RB is only 6.62R away) | No trade by default. With the fallback: a fixed 3R at 1059, hit. |
  | Bullish mirror image | BUY at 1002, SL 989, TP 1088 → same R |
  | 4H RB: the 5m RB that made the 4H high, retested next 4H candle | Limit at 1100.5, SL 1109 → **+10.41R**. No trade with the setup off (the default). |
  | Price runs through the stop | −1R on all three entries |
  | Still open at 16:00 | Closed at the 15:59 close: (1098 − close) / 13 R, managed 0.5 + half of that |
  | No 1H RB below, previous 4H low too close | No trade by default. With the fallback: a fixed 3R at 1059, hit. |
  | No 1H RB below, previous 4H low 48 points down | TP at the 4H low 1050 → **+3.69R**; the mirror image aims for the 4H high |
  | Longs only | The short is skipped |
  | Confirmation close: the push into the RB started at 1095; the 4th 5m candle after it closes at 1093.75 | SELL at 1093.75, SL 1111, TP 1012 → **+4.74R**. No trade with a 3-candle window, or when price runs through the stop first. Mirror image: BUY at 1006.25, same R. |
  | Targets capped at 5R (the 1H RB is 6.6R away) | Skipped |
  | Premium/discount filter on, short above the daily open | Kept |

- **Random-data check:** random prices have no edge, so results should average 0R or a little below. A strongly positive number would mean the code was peeking at future bars. Three seeded random walks of 15 trading days each on 1m bars, default settings:

  | Entry | Trades | Full to target | ½ at 1R + BE |
  |---|---|---|---|
  | RB close | 63 | −0.36R avg, 13% win | −0.32R avg, 40% win |
  | Body edge | 57 | −0.61R avg, 5% win | −0.35R avg, 35% win |
  | CE limit | 54 | −0.65R avg, 6% win | −0.47R avg, 26% win |

  Below zero is what conservative fills should give: the stop wins same-bar ties, and the 16:00 flatten cuts winners short. A few dozen trades prove nothing either way.

## Limitations

- **Not compiled in TradingView yet.** It has not run on a real NQ chart here: TradingView and every market-data site (Yahoo, Dukascopy, Databento, Massive) were blocked in this environment. PineTS is not TradingView's compiler. If the Pine editor shows an error, send me the message and line number.
- **Not yet confirmed on real NQ data.** The scenarios prove the code does what the rules say. They say nothing about whether the rules make money. Your chart's table and Pine Logs are the first real test.
- **The full-history 1H targets can't run in PineTS.** That test runtime can't evaluate `request.security` on test data, so the tests use *Target RBs from = Chart history*, which uses the identical rule. The full-history path is JS RB's own `htfZoneArrays` code, run the same way JS RB runs it.
- **5m swing levels come from the loaded chart.** A 5m wick that takes a swing high/low from before the chart's first bar won't count here, though JS RB (which reaches further back) would show it. This only matters in the first day or so of the chart.
- **Bar order inside a candle is unknown**, so the scoring is conservative. A stop and a target in the same 1m bar counts as the stop. A limit can't take profit on its fill bar.
- **4H candles** follow TradingView's 4H bars for the symbol: 18:00, 22:00, 02:00, 06:00, 10:00 and 14:00 NY on CME.
