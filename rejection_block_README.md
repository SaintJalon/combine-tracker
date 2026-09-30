# SaintTrades Rejection Block (ICT / Powell)

Two Pine Script v6 files:

- **`SaintTrades-RejectionBlock.pine`** (indicator) marks rejection blocks (RBs) the way Powell Trades (Dumb Money Concepts) and ICT teach them. It trades every RB three ways and keeps score in a stats table, so you can see what works on your symbol and timeframe instead of taking the rules on faith.
- **`SaintTrades-RejectionBlock-Strategy.pine`** (strategy) sends one of those entries to the Strategy Tester with real orders, costs and trade management. See [The strategy](#the-strategy).

No indicator is accurate on every day in every market, and this one doesn't claim to be. What it does:
- It applies the same strict rules every time.
- It never repaints.
- It measures its own results with conservative fills, so the stats table shows its real accuracy on your chart.

## Where the rules come from

| Rule | Source |
|---|---|
| An RB is the **wick** of a candle that ran a level and closed back on the other side. Bearish: upper wick reaches the level, body stays below. | Powell RB indicators (FWS "Powell RBs", "Powell Key Opens + KO Rejection Blocks") and ICT |
| RBs form off **key opens**: 00:00, 02:00, 08:30, 09:30, 10:00, 13:30 and 18:00 New York. They are marked on the 5m / 15m. | Powell (Key Opens videos, FWS key-open indicator) |
| RBs form off **liquidity**: previous day/week high and low, session highs and lows, and swing points. A wick zone with no sweep behind it is much less reliable. | ICT |
| Zone = body edge to wick tip. **CE / mean threshold** = 50% of the wick. It is the main entry, with the stop past the tip. | ICT; Powell ("limit at the CE, stop at the old low") |
| **Invalidation:** any wick past the tip, no close needed. | Powell (FWS) |
| **Entry trigger:** after price taps the zone, drop to a lower timeframe and wait for a CISD close. A wick poke doesn't count. | Powell "Entry Triggers"; ICT CISD |
| **Wick theory:** skip a wick that forms equal highs/lows (fresh liquidity that tends to get run). A close through the 50% means the wick is being disrespected. | Powell "Wick Theory" |
| **Context:** HTF bias, premium/discount relative to the 00:00 and 18:00 opens, killzones. | Powell dashboard (FWS V2), ICT |

Research links: [FWS Powell RBs](https://www.tradingview.com/script/xWAzSVpj-Rejection-Block-by-FWS-Powell-RBs/) · [Powell Key Opens + KO RBs](https://www.tradingview.com/script/PGP60HkE-Powell-Key-Opens-KO-Rejection-Blocks-by-FWS/) · [Powell – Rejection Wick](https://www.youtube.com/watch?v=6opmiyFvJBA) · [Powell – Key Opens #2](https://www.youtube.com/watch?v=rsbBubev4PM) · [Powell's Wick Theory script](https://www.tradingview.com/script/1wiaRNzT-Powell-s-Wick-Theory/) · [ICT Rejection Block guide](https://www.ictkillzone.com/ict-rejection-block) · [LuxAlgo RB concept](https://www.luxalgo.com/library/concept/rejection-block/) · [LiquidityScan RB](https://liquidityscan.io/blog/rejection-block-in-ict-trading-wick-reversals)

## The model (bearish; bullish is the mirror image)

1. **Levels.** Key opens are two-sided: a wick can reject them from either side for the rest of the NY trading day, and a touch is enough. PDH/PDL, PWH/PWL, the Asia / London / NY AM highs and lows, and swing highs/lows are one-sided liquidity. Once price trades through one, it's spent.
2. **RB candle.** On the RB timeframe, a candle's upper wick runs one or more levels and its body stays below every level it counts. The wick has to dominate the candle:
   - at least 40% of the range
   - at least 1× the body
   - longer than the lower wick
   - at least 0.25 × ATR(14)
3. **Zone** = body top → high. **CE** = its midpoint. **Stop** = high + 4 ticks.
4. **Displacement (CISD).** Take the unbroken run of up-close candles that pushed into the high, and note the open of its first candle. A later candle that closes below that open is displacement. The box is dashed until that close prints, then solid, with ✓ on the label.
5. **Entries, all measured on every RB.**
   - **CE limit** at 50% of the wick.
   - **Body-edge limit** at the zone's near edge. It fills on the first touch.
   - **CISD after tap:** after the first touch, market entry on the first chart-bar close back below the open of the run that made the post-tap high.
6. **Targets.** TP1 = 1R. TP2 = 2R, or the nearest untaken opposing liquidity.
7. **End.** The RB ends when a wick trades past the tip or at 16:00 NY. At 16:00, unfilled entries are cancelled and open trades close at that bar's close.

## Install

Pine Editor → paste `SaintTrades-RejectionBlock.pine` → **Save** → **Add to chart**. After any code change, remove the indicator from the chart and add it again.

**Suggested start (NQ/MNQ):** a 1m chart with **RB timeframe = 5m**, or a 5m chart with **RB timeframe = 15m**. That is Powell's workflow: the RB on the 5m/15m, the entry refined on a lower timeframe.

## Inputs

**1 · Rejection block**
| Input | Default | What it does |
|---|---|---|
| RB timeframe | Chart | The candle the wick is read on. Pick one at or above the chart timeframe that the chart timeframe divides into evenly. |
| Zone runs from | Body edge | **Body edge** = the wick only. **Close** = from the close to the tip, which also takes in the body when the candle closed away from the wick. |
| Rejecting wick ≥ % of range / ≥ body × / ≥ ATR × | 40 / 1.0 / 0.25 | How dominant the wick must be. Raise these for fewer, cleaner RBs. |
| Invalidate when | Wick past tip (Powell) | Or **Close past tip (ICT)**. The stop always sits past the tip. |
| Displacement window | 6 RB candles | How long after the RB the CISD close may come and still count. |

**2 · Levels the wick must run**
| Input | Default | What it does |
|---|---|---|
| Powell key opens + each time | all on | 00:00, 02:00, 08:30, 09:30, 10:00, 13:30, 18:00 NY. A key open needs a chart bar that opens at that exact minute, so 08:30 / 09:30 / 13:30 don't exist on a 1H chart. |
| Previous day / week high-low | on | The day is the chart's daily bar (18:00 NY on CME). |
| Session highs/lows | on | Asia 20:00–00:00, London 02:00–05:00, NY AM 09:30–12:00. |
| Swing highs/lows | on, strength 3, keep 10 | Fractal swing points on the RB timeframe. |
| Liquidity sweep: min ticks through | 1 | How far past a high/low the wick must trade. Key opens only need a touch. |
| Draw key opens / liquidity | on / off | Level lines on the chart. |

**3 · Entry, stop & targets**
| Input | Default | What it does |
|---|---|---|
| Entry shown & alerted | CE limit | Which of the three entries gets lines, markers and alerts. The table measures all three either way. |
| Stop buffer | 4 ticks | Past the tip. 4 ticks = 1 NQ point. |
| TP1 / TP2 | 1R / 2R fixed | TP2 can instead be the nearest untaken opposing liquidity. |
| CISD entry window | 12 bars | Chart bars after the tap in which the CISD close must come. |
| Expire / flatten | 16:00 NY | Or **Never** (RBs live until the tip is taken, up to 4,500 bars). |

**4 · Filters (off = measured only)**
| Input | Default | What it does |
|---|---|---|
| Minimum grade | B | The grade counts five things: key level swept, killzone, premium/discount, daily bias, clean tip. A+ = 4–5, A = 3, B = 2, C = 0–1. |
| Require key level / killzone / P-D / bias / clean tip | off | Each one turned on hides RBs that fail it. |
| Killzones | London 02–05, NY AM 08:30–11, NY PM 13:30–16 | Judged on the RB candle's open time. |
| Equal high/low tolerance / lookback | 4 ticks / 20 candles | The clean-tip check (wick theory). |
| Require displacement before the first touch | off | With this on, an RB touched before it displaced is removed and never traded. |

**5 · Visuals / 6 · Stats** (the defaults keep the chart clean):

| Input | Default | What it does |
|---|---|---|
| RB labels | Compact | **Compact** = direction, grade and ✓ once displaced, e.g. `▼ A ✓`. **Full** also lists the levels the wick ran, e.g. `▼ A ✓ · 10:00+PDH`. **Off** = no labels. |
| Keep labels on finished RBs | off | An RB's label goes when its zone ends; the dimmed box stays. |
| RBs kept on the chart | 8 | Older drawings go first. |
| Entry / stop / TP lines | newest 1 live RB | Their prices sit at the right edge. |
| Stats table | Compact | **Compact** = the three entries compared. **Full** adds the filter lab and grades. **Off** hides it. |

Key-open times are written at the start of each dotted line, so the right edge is left for the entry, stop and target prices.

Hover over any RB label for its zone, CE, stop, the levels it ran, which filters passed, and its CISD level.

## Reading the stats table

| Section | Meaning |
|---|---|
| Setups / Live | RBs whose three entries have all resolved / RBs still in play. |
| Entry rows | For each entry: fills, fill %, then **→TP1** and **→TP2**. Each shows *average R per filled trade · win %*, with the whole position held to that target on the same stop. |
| Filter lab (**Stats table = Full**) | Fills of the selected entry (▶) where each filter held, whether or not you require it. Compare each row with **All fills**. A filter earns its place only if its row beats *All fills* on a decent sample. |

Judge by **average R**, not win rate. A 60% TP1 hit rate can still lose money.

## How to find what's accurate on your market

1. Run it on NQ1! 5m (or 1m with 5m RBs) over as much history as your plan loads.
2. Set **Stats table** to Full. In the filter lab, find the rows with positive average R and **at least ~100 fills**. Ignore smaller rows; they are noise.
3. Turn on only those filters, then check the result on a *different* date range than the one you chose them on (out of sample).
4. Pick the entry type from the entry rows. CE gives better R but fills less often. Body-edge fills almost every time at a worse price. CISD fills least but confirms first.
5. Repaint check: leave it running through a live session, screenshot, reload, compare. Finished RBs must not move.

## What was checked

- **Non-repainting.** All state changes on confirmed bars only. An RB exists only after its candle closes. A level only counts if it existed, and was untaken, before the RB candle opened.
- **Conservative fills.** A limit fills from the bar after the RB is known. Its targets count from the bar after the fill, and a stop on the fill bar counts. A CISD entry fills at the trigger close. A limit is cancelled if the zone is invalidated, the RB expires, or price reaches TP2 before filling.
- **Runs end to end in PineTS** (an open-source Pine v6 runtime) on synthetic data, across every entry mode, both zone modes, both invalidation modes, every required filter, and RB timeframes of 5m, 15m and 1H from 1m, 5m and 15m charts. No runtime errors.
- **Scenario tests with known answers:**

  | Scenario | Checked |
  |---|---|
  | Bearish RB off PDH | Zone 98–103, CE 100.5, stop 104; formed on its own candle's close; each entry's fill, TP1 and TP2 |
  | Bullish mirror | Exact mirror results |
  | Body closes through the level | No RB |
  | Wick past the tip | CISD entry cancelled, filled limits stopped at −1R, a new RB off the higher wick |
  | Same scenario on a 1m chart with 5m RBs | Identical zone and results |

- **Random-data sanity check.** On random synthetic prices, the large rows average close to 0R (−0.11R to +0.04R over 171–262 fills), as they should when there's no edge to find. Small rows swing further (±0.25R over 27–67 fills), which is why step 2 above asks for about 100 fills. No look-ahead is inflating the numbers.
- **Syntax** passes the `pynescript` parser.

## The strategy

`SaintTrades-RejectionBlock-Strategy.pine` is the indicator's rules wired into the Strategy Tester, built the same way as `crt_ict_strategy.pine`. It uses the indicator's code unchanged for everything that decides **whether and where** to trade:
- levels
- the rejection candle
- zone, CE and stop
- displacement
- grade and filters
- invalidation
- the 16:00 expiry
- the CISD trigger

A diff against the indicator shows only the order handling, inputs, table and header changed. What's different is **who decides the fills**: TradingView's broker emulator.

- **One entry type, real orders.**
  - **CE limit** and **Body-edge limit** go in as limit orders on the close of the bar the RB is found on.
  - **CISD after tap** sends a market order on the trigger bar's close, filled at the next bar's open.
  - Each entry carries a bracket: T1 (TP1 + stop) for the partial, T2 (TP2 + stop) for the rest.
  - The bracket is re-sent every bar while the order works or the trade is open. T1 is never re-sent after it fills.
- **One position at a time.** Every working limit shares one OCA group, so the first fill cancels the rest.
  - An RB that forms during a trade waits, and gets its order once you're flat, if its zone is still untouched.
  - An RB touched before its order could work is skipped (first touch only).
- **Management.**
  - 50% off at TP1, then the stop moves to breakeven.
  - Flat at 16:00 NY: a market close on the bar that ends 16:00, filled at the next open.
  - Nothing new until the 18:00 roll.
- **Costs** match your CRT strategy: $0.61 per contract per side (Topstep MNQ), 1 tick of slippage and margin 0. Change them in Properties.

**Strategy inputs** (the indicator's inputs are all still there):

| Input | Default | What it does |
|---|---|---|
| Entry | CE limit | The entry that gets traded. Pick it from the indicator's table first. |
| Close at TP1 (%) | 50 | The partial at TP1. 100 = all out at TP1. |
| Stop to breakeven after TP1 | on | Moves the rest's stop to the fill price. |
| Entry window (NY) | 08:30–16:00 | Orders are placed, and stay working, only inside this window. `0000-0000` = all hours. |
| Direction | Both | Or longs / shorts only. |
| Max trades per day | 2 | Fills per NY trading day (rolls at 18:00). Once it's reached, working orders are cancelled. |
| Daily loss limit (R) | −2 | Stops new orders for the day. 0 = off. |
| Sizing | Fixed, 0 = auto | Auto = 2 contracts on micros (MNQ), 1 on full-size (NQ). **Risk %** sizes from the stop; an RB that can't carry 1 contract is skipped. |

**Strategy table:** Compact shows closed trades, win rate, expectancy, net R, profit factor and the longest losing streak. Full adds setups drawn, orders placed, fills, TP1 hit rate, today, and results by grade. R comes from the broker's fills after costs: (points × contracts − costs) / (planned risk × contracts).

On the chart, only RBs the strategy traded stay drawn. Each keeps its label with the result, e.g. `▼ A ✓ · +1.32R`, and the Tester's own markers show `Long +2`, `TP1 −1`, `BE −1`, `TP2 −1` or `16:00`. Turn on **Show RBs that weren't traded** to keep the others dimmed; hovering one of their labels says why it wasn't traded (in a trade, daily cap, touched first...).

### Validating in the Strategy Tester

1. **History.** Check the Tester's date range. About 10,000 bars is roughly 7 weeks of 5m NQ. Test several windows separately rather than adding them together.
2. **Set up.** NQ1! or MNQ1! on 5m (or 1m with RB timeframe 5m). Confirm commission, slippage and quantity in Properties. Turn on **Bar Magnifier** if your plan has it: it settles bars where a stop and a target both trade.
3. **Check that orders fill.** "Orders placed" and "Filled" in the table should line up with the Tester's trade count. Orders but no trades usually means margin or quantity is set wrong.
4. **Spot-check 10 trades.** Entries should sit at the RB's CE (or edge), and exits at SL, TP1, TP2, BE or 16:00.
5. **Compare with the indicator** on the same chart and inputs. The strategy's expectancy should be close to the indicator's row for that entry. The indicator is conservative when a stop and a target trade in the same bar; the Tester follows a price path.
6. **Sample size and out of sample.** Don't trust fewer than about 100 closed trades. Tune on older data and judge on newer data.

### What was checked (strategy)

- **Same signals as the indicator.** Diffed against it: `finalize` (detection) differs only in which entry becomes the plan. `stepCisd` differs only in where it reads the CE's TP2. Levels, zones, grades and filters are byte-identical.
- **Runs end to end in PineTS's strategy engine** with no runtime errors. Every run tested:
  - all three entries
  - opposing-liquidity TP2 and "Never" expiry
  - risk sizing, direction filter, 0% and 100% partial, 3 fixed contracts, no breakeven, no loss limit
  - required displacement and minimum grade A+
  - 1m→5m, 1m→15m and 15m→1H

  In every run, orders filled = trades closed = broker trades, and nothing was left open. With fixed size, the position never exceeded one trade's contracts.
- **Known-answer scenarios** (hand-calculated first):

  | Scenario | Result |
  |---|---|
  | Bearish PDH sweep, CE limit | Filled at 100.5, TP1 97, breakeven, TP2 93.5 → **+1.32R** after costs |
  | Same, body-edge limit | 98 → 92 / 86 → **+1.39R** |
  | Same, CISD after tap | Market at the 19:25 open, TP1 89.9, TP2 82.85 → **+1.41R** |
  | Open at 16:00 | TP1, then the rest flattened at the 16:00 open → **+0.96R** |
  | Bullish mirror | Same result as the bearish case |

- **Bugs the tests caught and fixed.**
  - Two orders filling on the same bar could leave one trade unbooked. Now every filled order is tracked.
  - CISD market orders sent with `limit=na` never filled in PineTS. They now go in as plain market orders.
  - Exits sent only once, before the entry fills, were dropped by PineTS. Brackets are now re-sent every bar.
- **Random-data check.** With same-bar exits ruled out, random prices give −0.08R to +0.11R over 16–30 trades, and CISD entries give −0.19R. Those are no-edge numbers, as they should be.

  PineTS's own emulator lets a TP1 fill on the entry bar *before* the entry, which inflates results (+0.41R on the same random data). That's a quirk of the test engine; TradingView orders fills along the bar's price path. So PineTS numbers were used to check logic, never as performance.

## Limitations

- **Not compiled in TradingView yet.** Neither file has run on a real NQ chart here: TradingView and market data were blocked in this environment. PineTS is stricter than a parser but is not TradingView's compiler. If the Pine editor shows an error, send me the message and line number.
- **Strategy fills near the entry bar.** Both the Strategy Tester and PineTS have to guess the order of prices inside a bar. Use Bar Magnifier, and judge the strategy against the indicator's conservative numbers.
- **Research was done through search summaries.** TradingView, YouTube and most blog pages were blocked, so rules came from search results that describe Powell's videos and the Powell-based indicators. Where sources disagreed, the choice is an input (zone edge, invalidation) or is listed as an assumption in the file header.
- **Clusters of wicks are not merged** into one zone (ICT's "highest body to highest wick"). Each RB is one candle; later wicks into it count as taps.
- **One zone per area.** A new wick that stays inside a live RB of the same direction is a retest of it, not a new RB.
- **Key opens need exact bars:** 08:30 / 09:30 / 13:30 appear on charts of 30m and lower.
