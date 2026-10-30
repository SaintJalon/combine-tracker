# SaintTrades RB Flow (key level → 5m RB → 1H RB)

`SaintTrades-RBFlow.pine` turns your model into buy and sell signals with an entry, a stop and a target:

> Price rejects a key level (above all the previous 4H high or low) with a **5-minute rejection block**, then runs to the nearest untouched **1-hour rejection block** on the other side.

It finds every setup on your chart's history, takes each one three ways (market at the RB close, body-edge limit, CE limit), and scores them. You get the answer from your own chart: does this make money, on which entry, at which levels, at what time of day, and day by day.

It never repaints: everything runs on closed bars, and a level or RB only counts after its candle has closed.

## The model

Your two screenshots, as rules:

| Screenshot | What happened | Rule |
|---|---|---|
| Oct 30, 10:00 | The 5m candle runs above the 4H high, closes back below with a long upper wick (the red **M5** box under "Prev 4H High"), and price falls 600 points | **Sweep:** a 5m RB whose wick reaches a key level while its body stays on the near side |
| Oct 30, 10:00 | That same 5m RB *is* the high of the 4H candle, so it sits at "Prev 4H High" afterwards | **4H RB:** the 5m RB that made a 4H candle's high or low, traded on the retest during the next 4H candle |
| Oct 29, 20:00 | M5 RBs on the way down, price heading for the white **H1** box below | **Target:** the nearest untouched opposing 1H RB. Shorts run to a bullish 1H RB below, longs to a bearish 1H RB above |

**Rejection block** (both timeframes): a candle whose wick dominates it:
- the wick is at least 40% of the range
- the wick is at least 1× the body
- the wick is longer than the other wick
- the wick is at least 0.25 × ATR(14) of that timeframe

Zone = body edge to wick tip. CE = 50% of the wick. These are your ST RB rules.

**Key levels** are the ones your KeyLevels indicator draws:
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
| **Entry** | **RB close (market):** the close of the 5m RB candle. **Body-edge limit:** the bottom of the wick zone. **CE limit:** 50% of the wick. Pick one under *Entry shown & alerted*. The table measures all three. |
| **Stop** | 5m RB tip + 4 ticks (1 NQ point) |
| **Target** | The near edge of the nearest untouched bullish 1H RB below the entry (or its CE, an input) |
| **Taken only if** | The target is at least **1.5R** away. If the nearest 1H RB is closer than that, the trade is skipped (or the next 1H RB out is used, an input). If there is no 1H RB below, it is skipped (or a fixed-R target is used). |
| **Ends** | At the stop or the target. At **16:00 NY** anything still open closes at the bar's close and unfilled limits are cancelled. No new signals until the 18:00 open. |

On the chart each signal gets:
- its red/green **5m RB** box
- a **SELL 28,845.00** label (hover it for setup, level, stop, target, R:R and contract count)
- TradingView-style **TP / SL boxes** with prices
- the white **1H target** box

Pending limits are dashed until they fill. When a trade ends, its result (e.g. **+21.8R** or **−1.0R**) is printed at the exit.

## Install

1. Pine Editor → paste `SaintTrades-RBFlow.pine` → **Save** → **Add to chart**.
2. Use **MNQ1! or NQ1! on the 1-minute chart** (a 5m chart works too, with the same results). Defaults are your model: 5m entry RBs, 1H target RBs.
3. Load as much history as your plan allows (scroll left), then read the table.

After any code change, remove it from the chart and add it again.

## Confirming it over past days

This is how you and I check the model, one day at a time:

1. **Table → Full.** The bottom section lists the last 10 trading days: trades, wins–losses, net R.
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
| 4H RB | on | The 5m RB that made the 4H high/low, traded on the retest |
| Entry / target RB timeframe | 5m / 1H | The chart timeframe must divide the entry timeframe |
| Direction | Both | Or longs / shorts only |
| While a trade is live | One at a time | A new signal is skipped while the shown entry's trade is pending or open. Or skip the same direction only, or take every signal. |
| Only signal inside (NY) | off, 08:00–16:00 | A time window for new signals |

**2 · Key levels:** each group can be turned off. *4H only* = turn off everything except **Previous 4H high / low**.

| Input | Default | What it does |
|---|---|---|
| Wick may stop short of a level by | 0 ticks | 0 = touch or trade through |
| One signal per level per direction | on | Stops repeat signals off the same level |

**3 · Rejection blocks:** the wick rules above (40% / 1× body / 0.25 ATR) and how long a 1H RB stays a target (10 days).

**4 · Entry, stop & target**
| Input | Default | What it does |
|---|---|---|
| Entry shown & alerted | RB close (market) | Body-edge limit and CE limit are the others. A 4H RB is only known at the 4H close, so its "market" entry is the body-edge limit. |
| Stop buffer | 4 ticks | Past the tip |
| TP at the target RB's | Near edge | Or its CE |
| Minimum R:R | 1.5 | Below this the trade is skipped |
| Max stop size | off | Points. Skip RBs with a wider stop. |
| Sweep limits cancel after | 60 min | 4H RB limits cancel when the next 4H candle closes |
| TP1 for ½ + breakeven | 1R | Used by the managed result |
| Results use | Full to target | Or **½ at TP1 + breakeven**: half off at TP1, stop to entry, the rest to the 1H RB |
| Flatten & cancel at | 16:00 NY | Or 17:00 NY (close), or Never |
| Risk per trade ($) | off | Shows how many contracts fit your risk, in the label and alert |

## Reading the table

| Row | Meaning |
|---|---|
| Setups / Live / days | Signals found, signals still running, trading days on the chart |
| **Entry rows** | For each entry: trades filled / trades with a valid target, **Hit 1H** = share that reached the 1H RB before the stop, **Avg R** and **Net R** with the whole position to the target, and **½ + BE** = average R and win % when managed |
| ▶ row | For the shown entry: max drawdown in R, longest losing run, share of green days, net R |
| **Breakdown** (Full) | The shown entry split by setup, side, the level swept (4H / day / week+ / session) and the time of the signal (Asia, London, NY AM, NY PM) |
| **Days** (Full) | The last 10 trading days |

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
- **Known-answer scenarios** (hand-calculated first, 22 checks, all pass):

  | Scenario | Result |
  |---|---|
  | 5m RB sweeps the previous 4H high at 1105 (wick 1110, close 1098), bullish 1H RB at 990–1010 below | SELL at 1098, SL 1111, TP 1010 → **+6.77R**; managed **+3.88R** |
  | Same, body-edge limit | Filled at 1100 on the retrace → **+8.18R** |
  | Same, CE limit at 1105 | Price never came back that high → no trade |
  | TP at the 1H RB's CE (1000) | **+7.54R**. If price stops at 1005 instead, it is flattened at 16:00 for +7.15R. |
  | Minimum R:R 7 (target is 6.77R) | Skipped |
  | Bullish mirror image | BUY at 1002, SL 989, TP 1090 → same R |
  | 4H RB: the 5m RB that made the 4H high, retested next 4H candle | Limit at 1100.5, SL 1109 → **+10.65R**. Off with the setup turned off. |
  | Price runs through the stop | −1R on all three entries |
  | Still open at 16:00 | Closed at the 15:59 close: (1098 − close) / 13 R, managed 0.5 + half of that |
  | No 1H RB below | Skipped. With the fixed-R fallback: 3R target at 1059, hit. |
  | Longs only | The short is skipped |

- **Random-data check:** random prices have no edge, so results should average about 0R. A strongly positive number would mean the code was peeking at future bars. Three seeded random walks of 15 trading days each on 1m bars, all levels on, taking every signal:

  | Entry | Trades | Full to target | ½ at 1R + BE |
  |---|---|---|---|
  | RB close | 120 | −0.26R avg, 12% hit | +0.00R avg, 51% win |
  | Body edge | 120 | −0.35R avg, 12% hit | −0.05R avg, 51% win |
  | CE limit | 110 | −0.39R avg, 7% hit | −0.35R avg, 38% win |

  Slightly below zero is what conservative fills should give: the stop wins same-bar ties, and the 16:00 flatten cuts winners short. Seeds swing from +0.11R to −0.83R, so a few dozen trades prove nothing either way.

## Limitations

- **Not compiled in TradingView yet.** It has not run on a real NQ chart here: TradingView and every market-data site (Yahoo, Dukascopy, Databento, Massive) were blocked in this environment. PineTS is not TradingView's compiler. If the Pine editor shows an error, send me the message and line number.
- **Not yet confirmed on real NQ data.** The scenarios prove the code does what the rules say. They say nothing about whether the rules make money. Your chart's table and Pine Logs are the first real test.
- **JS RB isn't in this repo**, so the 5m and 1H RBs use your ST RB wick rules. If JS RB draws boxes this doesn't, or the other way round, paste me JS RB's code and I'll match it. Set **Draw target RBs = All untouched** to compare the 1H RBs side by side.
- **Bar order inside a candle is unknown**, so the scoring is conservative. A stop and a target in the same 1m bar counts as the stop. A limit can't take profit on its fill bar.
- **4H candles** follow TradingView's 4H bars for the symbol: 18:00, 22:00, 02:00, 06:00, 10:00 and 14:00 NY on CME.
