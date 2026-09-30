# SaintTrades Rejection Block (ICT / Powell)

`SaintTrades-RejectionBlock.pine` is a Pine Script v6 indicator. It marks rejection blocks (RBs) the way Powell Trades (Dumb Money Concepts) and ICT teach them. It trades every RB three ways and keeps score in a stats table, so you can see what works on your symbol and timeframe instead of taking the rules on faith.

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

**5 · Visuals / 6 · Stats**: colours, CE line, how many RBs stay drawn (15), how many live RBs show entry/stop/TP lines (1), and the table position.

Hover over any RB label for its zone, CE, stop, which filters passed, and its CISD level.

## Reading the stats table

| Section | Meaning |
|---|---|
| Setups / Live | RBs whose three entries have all resolved / RBs still in play. |
| Entry rows | For each entry: fills, fill %, then **→TP1** and **→TP2**. Each shows *average R per filled trade · win %*, with the whole position held to that target on the same stop. |
| Filter lab | Fills of the selected entry (▶) where each filter held, whether or not you require it. Compare each row with **All fills**. A filter earns its place only if its row beats *All fills* on a decent sample. |

Judge by **average R**, not win rate. A 60% TP1 hit rate can still lose money.

## How to find what's accurate on your market

1. Run it on NQ1! 5m (or 1m with 5m RBs) over as much history as your plan loads.
2. In the filter lab, find the rows with positive average R and **at least ~100 fills**. Ignore smaller rows; they are noise.
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

## Limitations

- **Not compiled in TradingView yet.** It hasn't run on a real NQ chart here: TradingView and market data were blocked in this environment. PineTS is stricter than a parser but is not TradingView's compiler. If the Pine editor shows an error, send me the message and line number.
- **Research was done through search summaries.** TradingView, YouTube and most blog pages were blocked, so rules came from search results that describe Powell's videos and the Powell-based indicators. Where sources disagreed, the choice is an input (zone edge, invalidation) or is listed as an assumption in the file header.
- **Clusters of wicks are not merged** into one zone (ICT's "highest body to highest wick"). Each RB is one candle; later wicks into it count as taps.
- **One zone per area.** A new wick that stays inside a live RB of the same direction is a retest of it, not a new RB.
- **Key opens need exact bars:** 08:30 / 09:30 / 13:30 appear on charts of 30m and lower.
