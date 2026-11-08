# SaintTrades Top/Bottom Tick

`SaintTrades-TopBottomTick.pine` is a Pine Script v6 indicator for top and bottom ticks taken off rejection blocks (RBs), built from the rules taught in 15 videos (listed below). It:
- marks every RB with the Gann box those videos use
- rests a limit at the RB's CE
- prints **TOP** or **BOT** where that limit fills
- grades the fill on 11 confluences (12 with SMT)
- measures every setup four ways, plus Powell's daily risk plan, in a stats table

No indicator catches every top and bottom. What this one does:
- It applies the same rules every time.
- It never repaints.
- It reports its own results with conservative fills, so you can see what actually works on your symbol before you trust it.

It sits beside `SaintTrades-RejectionBlock.pine`, which stays as it was. That one is built around Powell's key opens and CISD. This one adds the higher-timeframe gaps, the Gann box, the front-run limit and the confluence grade.

## Where the rules come from

| Rule | Source |
|---|---|
| An RB is the **wick** of a candle that traded into a higher-timeframe PD array and closed back away from it: "wicking it and not closing above it". Mark the wick, not the body. | GSTRADES, *How To Top/Bottom Tick With Rejection Blocks* |
| The PD array is mostly a **1H-or-higher fair value gap**, or liquidity such as the previous day low. Read the wick on the 5m/15m. | GSTRADES |
| RBs on the **15m and up, preferably 1H/4H**. A wick off a PD array is higher probability than a plain sweep. A wick that sweeps the previous candle also counts. | Shinobi, *My 1 Minute Top Tick Scalping Strategy* |
| Gann box on the wick: **0** = tip, **0.25**, **0.5** = CE, **1** = body edge. Enter at 0.5; 0.25 is the deeper, better-priced fill. The RB is invalid once 0 is run. | GSTRADES |
| Put the limit **2–3 ticks in front of the CE** so it fills when price stops just short. | Shinobi (Powell allows 2 ticks for spread) |
| Stop a little past the wick, or a **fixed 5–10 points**. | GSTRADES; Powell, *Powell Model 1/2 and 2/2* |
| Shorts above, longs below the **midnight open** (and the 18:00 open). | GSTRADES, Shinobi, Powell |
| A+ setups: the CE lines up with a **lower-timeframe gap**, with the **OTE (62–79%)** of the leg, or with another RB. | Shinobi; *Rejection Blocks Explained* (78.6) |
| High probability when liquidity is **engineered just below the CE** (equal highs) before price runs into it. | Powell, *Powell Model 1/2 and 2/2*, *Key Opens 2/2* |
| **Key opens**: 18:00, midnight and 10:00 matter most; 09:30 and 13:00 daily; 08:30 on news days. | Powell, *Key Opens 1/2 and 2/2* |
| **CISD**: a close back through the open of the run, then a retest. An inverted gap in that leg is extra confirmation. | Powell, *CISD*; GSTRADES ("if we inverse those, perfect") |
| **PXH/PXL daily bias**: a close above the previous day's high means expect a higher high, and so on. | Powell, *Pxl 1/2* |
| Trade RBs **with order flow**; use recent RBs; avoid very long news wicks; an A+ RB sweeps liquidity and displaces away. | *ICT Rejection Block, Episode 1* |
| Avoid **equal highs/lows** near the entry; **SMT** divergence with ES makes a better RB. | *Rejection Blocks Explained*; Powell, *Key Opens 2/2* |
| **Daily risk plan**: one full-size trade, and a win ends the day. After a loss, half size, then a quarter. Then stop. | Powell, *Risk Management 3/3* |

Also read for context: Golden Forex *Rejection Block, PD Array 1/5*; Arjo *Rejection Blocks A-Z, Episode 4*; Milana Trades *Stop Hunt Block & Rejection Blocks*.

Three videos in the source playlists are hidden or removed and couldn't be read. Powell's three Psychology videos have nothing to code.

## The model (bearish; bullish is the mirror image)

1. **Where RBs form.**
   - Fair value gaps on two higher timeframes (1H and 4H by default). The wick must reach the gap, and the body must not close above its top. A gap dies once a chart bar closes through it.
   - Or the wick runs liquidity: previous day/week high, Asia / London / NY AM session high, the previous 1H/4H candle high, an RB-timeframe swing high, or the previous RB candle's high (the weakest trigger).
   - Or it touches a key open.
2. **RB candle** (RB timeframe, 15m by default). The upper wick must dominate the candle:
   - at least 40% of the range
   - at least 1× the body
   - longer than the lower wick
   - at least 0.25 × ATR(14)
3. **Gann box**: 0 = high, 1 = body top. 0.5 is the CE; 0.25 is a quarter of the way down from the high.
4. **Entries, all four measured on every RB:**
   - **0.5 CE** limit, `front-run` ticks below the CE (2 by default)
   - **0.25** limit, also front-run
   - **1**, the body edge, which fills on the first touch
   - **CISD after tap**: after the first touch, a market entry on the first close back below the open of the push into the zone
5. **Stop**: the high + 4 ticks, or a fixed size in points. **TP1** = 1R. **TP2** = the nearest untaken opposing liquidity (fallback 3R), a fixed R, or the midnight open.
6. **Ending.** An RB ends when:
   - a wick trades past 0
   - 12 RB candles pass with no fill (*RB life*)
   - 16:00 New York arrives: unfilled entries are cancelled and open trades close at that bar's close
   A limit is also cancelled if price reaches its TP2 before it fills (the draw was already taken).
7. **Score and grade.** Setup factors, known when the RB candle closes:

   | Factor | Holds when |
   |---|---|
   | PD array | the wick traded into an HTF gap |
   | Liquidity | it ran key liquidity or a key open |
   | P/D | the CE is above the midnight open (and the 18:00 open) |
   | Bias | the PXH/PXL daily bias is bearish |
   | Order flow | the last swing broken on gap timeframe A was a low |
   | Clean tip | the tip makes no equal highs with recent candles |
   | SMT | (optional) this chart made a new high and the comparison symbol didn't |

   Entry factors, known when the limit fills:

   | Factor | Holds when |
   |---|---|
   | Engineered liquidity | a swing high formed after the RB, between the body edge and the entry, and the move into the entry ran it |
   | LTF gap | the entry sits inside an unfilled chart-timeframe bearish gap |
   | OTE | the entry is a 62–79% retracement of the leg from the high to the low made after the RB, once that leg runs below the RB candle |
   | Displaced | a CISD close, or an inverted chart-timeframe gap from the leg into the high, before the fill |
   | Session | the fill is inside 08:30–16:00 New York |

   Grade = score / max: **A+** 75%+, **A** 62%+, **B** 50%+, else **C**.
8. **TOP / BOT.** When the selected entry fills at or above the minimum grade (B by default), a marker prints at the fill price, e.g. `TOP A ×1`. Hover it for the score breakdown, stop, targets and daily-plan size.
9. **Daily plan.** The first qualifying fill each New York day is full size (×1), and a win ends the day. After a loss the next fill is ×½, then ×¼, then the day is over. One plan trade is open at a time.

## Install

Pine Editor → paste `SaintTrades-TopBottomTick.pine` → **Save** → **Add to chart**. After any code change, remove the indicator from the chart and add it again.

**Suggested start (NQ/MNQ):** a 1m or 5m chart with **RB timeframe = 15m** and gaps on **1H and 4H** (the defaults). That's GSTRADES' and Shinobi's workflow: the HTF gap, the 15m wick, then the entry on a lower timeframe. For Powell's 4H wick CE, use a 5m–15m chart, **RB timeframe = 4H**, gaps on **D**, and turn the 16:00 flatten off.

To add SMT on NQ, set **SMT symbol** to `CME_MINI:ES1!`. On ES, use `CME_MINI:NQ1!`.

## Inputs

**1 · Rejection block**

| Input | Default | What it does |
|---|---|---|
| RB timeframe | 15m | The candle whose wick is the RB. A timeframe below the chart's falls back to the chart. |
| Zone runs from | Body edge | **Body edge** = the wick only (GS). **Close** = from the close to the tip. |
| Wick ≥ % of range / ≥ body × / ≥ ATR × | 40 / 1.0 / 0.25 | How dominant the wick must be. |
| Wick ≤ ATR × | 0 (off) | ICT: very long news wicks tend to get filled completely. |
| Invalidate when | Wick past tip | Or **Close past tip**. |
| RB life | 12 RB candles | ICT: recent RBs hold best. 0 = no limit. |
| CISD displacement window | 6 RB candles | How long after the RB a CISD close still counts as displacement. |

**2 · Where RBs form**

| Input | Default | What it does |
|---|---|---|
| HTF gaps · timeframe A / B | 1H / 4H | The gap timeframes. Timeframe A also sets order flow. |
| HTF gap minimum size / kept | 4 ticks / 6 per timeframe and side | Smaller gaps are ignored. Older ones are dropped first. |
| Key opens | 18:00, 00:00, 09:30, 10:00, 13:00 on; 02:00, 08:30, 13:30 off | Powell. Two-sided levels: a touch is enough. |
| Previous day / week, sessions, previous HTF candle, RB swings | on | Liquidity a wick can sweep. |
| Previous RB candle high / low | on | Shinobi's weakest trigger. It doesn't earn the liquidity point. |
| Liquidity sweep: min ticks through | 1 | How far past a high or low the wick must trade. |
| SMT symbol / lookback | blank / 10 RB candles | A correlated symbol for SMT. Blank = off. |

**3 · Entry, stop & targets**

| Input | Default | What it does |
|---|---|---|
| Entry shown & alerted | 0.5 CE | Which entry draws lines, prints TOP/BOT and alerts. The table measures all four either way. |
| Front-run the limit by | 2 ticks | Shinobi's 2–3 ticks in front of the CE. Applies to 0.5 and 0.25. |
| Stop | Past the tip, +4 ticks | Or **Fixed points** (10). |
| Skip RBs whose 0.5 stop is wider than | 0 (off) | For prop accounts. GS's stops run about 12.5 NQ points. |
| TP1 / TP2 | 1R / opposing liquidity (fallback 3R) | TP2 can also be a fixed R or the midnight open. |
| CISD entry window | 12 bars | Chart bars after the tap in which the CISD close must come. |
| 16:00 NY flatten | on | Cancels unfilled entries, closes trades and expires RBs at 16:00 New York. |

**4 · Score & filters**

| Input | Default | What it does |
|---|---|---|
| TOP / BOT, alerts & stats from grade | B | Fills below this grade get no marker or alert, and are left out of the entry rows and the daily plan. The filter lab still measures every fill. |
| Hide RBs with a setup score below | 0 | Hides weak RBs from the chart and the stats. |
| Require PD array / liquidity / P/D / bias / order flow / clean tip | off | Each one turned on hides RBs that fail it. |
| Premium / discount vs | Midnight + 18:00 open | Or the midnight open only. Before midnight, the 18:00 open stands in. |
| Clean tip tolerance / lookback | 4 ticks / 20 RB candles | Equal highs/lows check. |
| Engineered liquidity swing strength | 2 bars | Chart-timeframe swing points. |
| LTF gap minimum size | 2 ticks | Chart-timeframe gaps. |
| OTE | 0.62–0.79 | The retracement band. |
| Session | 0830-1600 | New York time, HHMM-HHMM. |

**5 · Daily risk plan** — on; at most 3 trades a day; plan trades exit at TP2.

**6 · Visuals / 7 · Stats** — the defaults keep the chart clean:
- live HTF gaps are drawn as gray boxes
- the 0.25 and 0.5 Gann lines show inside each RB box
- the newest 8 RBs and the last 150 TOP/BOT markers are kept
- entry/stop/TP lines show for the newest live RB
- the stats table is Compact; Full adds the filter lab

## Reading the stats table

| Row | Meaning |
|---|---|
| Header | RB timeframe, gap timeframes, finished setups and live RBs. |
| Daily bias / Order flow | Today's PXH/PXL bias and the order flow on gap timeframe A. |
| Entry rows | For each entry: fills at or above the minimum grade, the fill %, then **→TP1** and **→TP2**. Each shows *average R per filled trade · win %*, with the whole position held to that target on the same stop. |
| Daily plan | Plan trades and the share won; finished days, the share of green days, average R per day, and total R (size-weighted). The last row is today: the next trade's size, or whether you're done. |
| Filter lab (Full) | Every fill of the selected entry (▶), whatever its grade, split by the factors that held, then by grade. Compare each row with *All fills*. |

Judge by **average R**, not win rate. The filter lab only means something with about 100 fills in a row.

## How to find what works on your market

1. Run it on NQ1! 1m or 5m (15m RBs) over as much history as your plan loads.
2. Set **Stats table** to Full. In the filter lab, find the factors whose rows beat *All fills* on at least ~100 fills.
3. Turn those on as requirements, or raise the minimum grade. Then check the result on a *different* date range than the one you picked them on (out of sample).
4. Pick the entry from the entry rows:
   - **0.5 CE** fills more often than 0.25 at a worse price.
   - **0.25** gets the better R and fills less.
   - **1 (body edge)** fills almost every time.
   - **CISD** waits for confirmation.
5. Repaint check: leave it running through a live session, screenshot, reload and compare. Finished RBs and TOP/BOT markers must not move.

## What was checked

- **Non-repainting.** Every state change happens on confirmed bars only. An RB exists only after its candle closes, and a gap or level counts only if it existed before the RB candle opened. Entry factors use only swings confirmed, gaps formed and leg extremes made before the fill bar.
- **Conservative fills.** A limit fills from the bar after the RB is known. Its targets count from the bar after the fill, and a stop on the fill bar counts. A CISD entry fills at the trigger close.
- **Runs end to end in PineTS** (an open-source Pine v6 runtime) on synthetic NQ-like data with no runtime errors. The runs covered:
  - all four entries
  - both zone modes, both invalidation modes and both stop modes
  - all three TP2 modes
  - every requirement filter, SMT on and the plan off
  - RB timeframes of 1m, 3m, 5m, 15m, 1H and 4H on 1m, 5m and 15m charts
  - gap timeframes of 30m, 1H, 2H, 4H and D
- **Scenario tests with known answers** (5m chart, 15m RBs, 1H gaps):

  | Scenario | Checked |
  |---|---|
  | Bearish RB into a 1H gap | Gap 21040–21090 found. RB at 12:00 with 0 = 21070, 0.25 = 21060.5, 0.5 = 21051, 1 = 21032. Limits 21050.5 / 21060, stop 21071. **TOP** at 21050.5 on the 12:35 bar. 0.5 CE: +1R / +3R. 0.25: no fill. Body edge: +1R, then +1.23R at the 16:00 flatten. Score 6/11 (B); each factor checked by hand. |
  | Bullish mirror | Exact mirror prices, **BOT** at 20949.5, identical R. |
  | Wick past the tip | Filled and stopped on the same bar at −1R; the RB ends. |
  | Fixed 10-point stop | The CE limit is cancelled because price reached its TP2 first. |

- **Random-data check.** On 12 random-walk seeds (8 days of 1m each, TP2 = fixed 3R), the entry rows average close to 0R, as they should when there's no edge to find:

  | Entry | Fills | →TP1 | →TP2 (3R) |
  |---|---|---|---|
  | 0.5 CE | 1,001 | +0.02R | −0.00R |
  | 0.25 | 366 | +0.03R | +0.11R |
  | 1 body edge | 1,470 | +0.05R | +0.05R |
  | CISD after tap | 948 | −0.00R | +0.07R |

  Filter-lab rows swing by up to about ±0.15R between two sets of 6 seeds. "Key level / liquidity" read +0.16R on one set and −0.04R on the other, for example. That is why step 2 above asks for about 100 fills. No look-ahead is inflating the numbers.
- **Syntax** passes the `pynescript` parser.

Not checked here: compiling in TradingView itself (PineTS and pynescript stand in for it), and real NQ data. Run the repaint check above on a live chart before you rely on it.

## Limitations

- RB-timeframe and gap-timeframe candles are built from chart bars. Use a chart timeframe that divides evenly into them, such as a 1m or 5m chart for 15m RBs and 1H/4H gaps.
- Key opens need a chart bar that opens at that exact minute, so 08:30, 09:30 and 13:30 don't exist on a 1H chart.
- With `Fixed points`, the stop can sit inside the wick. The RB is still invalidated at the tip.
- SMT compares the RB candle's new high or low over the lookback. It doesn't match swing points one to one.
- The daily plan attributes a trade's result to the day it was taken, and holds the next day's first trade until that one closes.
