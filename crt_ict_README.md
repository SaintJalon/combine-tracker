# CRT + ICT CISD/FVG — NQ / MNQ

Two Pine Script v6 files:

- **`crt_ict_indicator.pine`**: draws each setup with its entry, stop and targets, fires alerts, and measures every setup in a stats table.
- **`crt_ict_strategy.pine`**: the same rules sent to the Strategy Tester. The code that decides whether and where to trade is copied from the indicator unchanged. Only the fill handling differs.

Both files compile with zero errors in TradingView's Pine editor. They have not yet run on a chart. See [Limitations](#limitations).

## The model (longs; shorts mirror it)

1. **C1** is the last *closed* candle on the CRT timeframe (default 60m). It sets CRT High, CRT Low and the 50% level.
2. **C2** is the CRT candle forming now. The first chart bar in C2 that trades below CRT Low is the **sweep**. That bar has to be inside an enabled killzone.
3. **CISD**: a chart bar closes above the open of the first candle in the run of down-close candles that ran into the sweep low.
4. **Arm**: within 20 bars of the sweep, three things must hold together: the CISD has printed, the close is back above CRT Low, and the leg left an untouched FVG. Entry, stop and targets are fixed on that bar.
5. **Trade**: the entry is a limit at the FVG's 50%. The stop sits 4 ticks below the sweep wick. TP1 is CRT 50%, where 50% of the position closes and the stop moves to breakeven. TP2 is CRT High. Everything is flat at 16:00 New York.

State machine per direction: `IDLE → SWEPT → ARMED → FILLED → CLOSED`, or `EXPIRED` from SWEPT or ARMED.

## Install

Pine Editor → paste the file → Save → **Add to chart**. After any code change, remove the study from the chart and add it again. Saving alone does not update a copy that is already on the chart.

## Inputs

**1 · CRT range**
| Input | Default | What it does |
|---|---|---|
| CRT timeframe | 60 | Sets the timeframe for C1 and C2. Options are 15 / 60 / 240 / D. It must be higher than the chart timeframe, or the script stops with an error. On NQ, 4H and daily ranges are often too wide to reach TP2 inside one session. |
| Draw the active CRT High / Low / 50% | on | Draws labelled lines for the range currently in play. |

**2 · Sweep & CISD**
| Input | Default | What it does |
|---|---|---|
| Minimum sweep depth (ticks) | 0 | How far past the level price must trade to count as a sweep. 0 means any trade through the level. 2–4 ignores one-tick pokes. |
| CISD window (bars) | 20 | The CISD and the arming must both happen within this many chart bars of the first sweep bar, or the setup expires. |
| Displacement filter | on | The CISD leg must show displacement, not drift. |
| Displacement must show | FVG | What counts as displacement: **FVG**, **Body ≥ ATR multiple**, **FVG or body**, or **FVG and body**. The FVG is `high[2] < low[0]` for longs, it must form after the sweep low, and price must not have traded back into it. |
| Body ≥ ATR(14) × | 1.0 | The candle body needed for body displacement. |

**3 · Entry, stop & targets**
| Input | Default | What it does |
|---|---|---|
| Entry | FVG 50% | **FVG proximal edge**: limit at the near edge (most fills, worst price). **FVG 50%**: limit at the gap's midpoint (consequent encroachment). **CISD close**: market order at the close of the arming bar. |
| Stop | Sweep wick | Stop goes beyond the sweep wick, or beyond the far edge of the FVG (tighter). The FVG option falls back to the wick when there is no FVG. |
| Stop buffer (ticks) | 4 | Added beyond the stop reference. 4 ticks = 1 NQ point. |
| Minimum R:R to TP2 | 2.0 | Setups below this are skipped and not drawn. This check runs before any TP1 check. |
| If the entry is past the CRT 50% | TP1 at a fixed R | TP1 is normally the CRT 50%. If the entry is already beyond it, **Fixed R** puts TP1 at entry ± the R below instead, or **Skip** drops the setup. With the wick stop this never triggers. Buying above the 50% puts the stop more than half the range away and TP2 less than half the range away, so R:R is always under 1 and the R:R check rejects the setup first. It only matters with the FVG stop. |
| TP1 fixed R | 1.0 | TP1 for those entries. |
| Runner target | TP2 | Where the part left after TP1 exits: **TP2** (opposite CRT extreme) or **TP3** (entry ± N R). |
| TP3 R multiple | 4.0 | Only used when the runner target is TP3. |
| Cancel unfilled entry after (bars) | 30 | Time limit on a working limit order. 0 = no time limit. The entry is also cancelled if TP1 trades first, at 16:00, or if C2 closes outside the range. |

**4 · Trade management**
| Input | Default | What it does |
|---|---|---|
| Close at TP1 (%) | 50 | The share of the position closed at TP1. 100 = all out at TP1. |
| Stop to breakeven after TP1 | on | Moves the runner's stop to the entry price. |
| Flatten at 16:00 NY | on | Closes open trades on the bar that ends at 16:00 and cancels working entries. Nothing new arms until the 18:00 open. |

**5 · Killzones (New York time, DST-aware)**
| Input | Default | What it does |
|---|---|---|
| Sweep must be inside an enabled killzone | on | Checked on the first bar that trades through the level. When off, sweeps at any hour count and are reported as "Outside KZ". |
| London 02:00–05:00 / NY AM 08:30–11:00 / NY PM 13:30–16:00 | AM only | Choose which killzones are enabled. |

**6 · Filters & daily limits**
| Input | Default | What it does |
|---|---|---|
| Direction | Both | Trade both directions, longs only, or shorts only. |
| Daily bias | off | Longs only when the entry is below the previous session's 50% (discount). Shorts only when it is above (premium). |
| Max trades per day | 2 | Counts filled trades plus any entry still working. The day is the CME session that opens at 18:00. |
| Daily loss limit (R) | −2 | Once today's realised R reaches this, working entries are cancelled and nothing new arms until the next session. 0 = off. |

**7 · Contract size**

In the indicator, **Account size** ($50k) and **Risk %** (0.5%) feed the NQ ($20/pt) and MNQ ($2/pt) contract counts shown on every setup label.

The strategy adds two inputs. **Sizing** chooses Fixed contracts (default **2**, so the 50% partial works) or Risk % (a setup that can't carry one contract is skipped). **Contracts** sets the fixed size. At 0.5% of $50k, most NQ stops are too wide for even 1 contract. Use MNQ1! for risk-based sizing.

**8 · Visuals / 9 · Stats table**: how many past setups keep their drawings (default 3), colours, table on/off, and text size. **Table rows** is **Compact** by default: 8 rows covering setups and fills, win rates, expectancy, net R and profit factor, the longest losing streak, and today. **Full** shows every row listed below.

A finished setup shrinks to a one-line result, for example `LONG +2.00R · TP2`. Hover over it to see its full entry, stop and target levels.

**Strategy Properties tab**: commission is $2.50 per contract per side, slippage is 1 tick, and capital is $50,000. Margin is set to 0 on purpose: without that, the Tester rejects every NQ order and reports nothing. Pine doesn't allow inputs inside `strategy()`, so costs can only be changed in Properties.

## The stats table

The rows below are the **Full** table. **Compact** shows only the key ones.

| Row | Meaning |
|---|---|
| Sweeps | Killzone sweeps that started a setup. |
| Setups found | Setups that armed and were drawn. |
| Filled | Setups whose entry filled. |
| Expired unfilled | Armed setups whose entry never filled. |
| Skipped | Setups dropped before drawing, by reason: R:R, TP1 (entry past 50% with Skip set), bias, caps, size, other. |
| Win rate → TP1 / → TP2 | Share of resolved trades that reached the level before the stop. |
| Win rate (R > 0) | Share of trades that made money, including TP1 then breakeven. |
| Avg R:R offered | Average planned R:R to TP2 at entry. It shows what the setups offered, not what they paid. |
| Expectancy | Average realised R per trade. This is the number that matters. |
| Net R | Total realised R. |
| Profit factor | Gross winning R ÷ gross losing R. |
| Max consecutive losses | Longest losing streak. |
| Avg win / avg loss | Average R of winning trades and of losing trades. |
| By killzone / By direction | Trades, win rate and R per trade for each group. |
| Entry past 50% | Trades that used the fixed-R TP1, measured separately so you can judge them on their own. |

**Indicator rules are conservative.** Fills only count from the bar after arming. On the fill bar, only the stop counts. When one bar trades both a stop and a target, the stop wins. That includes the breakeven stop on the bar that hits TP1.

**Strategy numbers come from TradingView's fills.** The broker emulator decides what fills, and the results are net of commission and slippage.

Your own `SaintTrades-CRT` tests showed a 65% TP1 hit rate that still averaged **−0.03R**. Judge this model by **Expectancy**, not by win rate.

## Validating in the Strategy Tester (NQ1!, 5m, ≥ 6 months)

1. **Check how much history you have.** The Tester's date range is at the top of its report. An Essential plan loads about 10,000 bars, which is roughly **7 weeks of 5m NQ**. Six months of 5m data needs Deep Backtesting (Premium and up). Without it, test several separate windows and don't add them together. A 15m chart with the 60m CRT reaches about 5 months and works as a cross-check only.
2. **Set up the chart.** Open NQ1! on 5m, add the strategy, and keep the defaults. In Properties, confirm the commission, slippage and quantity. Turn on **Bar Magnifier** if your plan has it.
3. **Check that orders fill.** Compare "Setups found" and "Filled" in the table with the Tester's trade count. Setups but no trades means orders are being rejected. Check margin and quantity before touching the signal logic.
4. **Spot-check 10 trades.** For each one in *List of Trades*, the entry should equal the label's E. Exits should land on SL, TP1, TP2 or breakeven, or at 16:00. The TP1 partial appears as its own row.
5. **Compare with the indicator.** Put the indicator on the same chart with the same inputs. The Tester's expectancy should come out equal to or better than the indicator's before costs. A large gap means many bars trade both a stop and a target. That points to NQ's volatility, not to an edge.
6. **Sample size.** Don't trust fewer than about 100 closed trades. Check max consecutive losses × your risk against the account's max loss ($2,000 on a 50k).
7. **Out of sample.** Tune on the older half of the data and judge on the newer half. A setting that only works on the data it was tuned on isn't an edge.
8. **Repaint check.** Leave the indicator running for a live session and screenshot it. Then reload and compare. Finished setups must not move.

## Audit (what was checked)

- **Repainting.** HTF data comes from `request.security(..., high[1], lookahead_on)`. The brief asked for `lookahead_off` with `[1]`, but that pairing shows each closed candle one candle later on history than live. That makes history differ from realtime, which is repainting, so the documented pattern is used instead. The state machine only advances on `barstate.isconfirmed`, so history and realtime take the same steps and alerts fire once at bar close.
- **Lookahead bias.** C2 is judged on its last chart bar's close, and a cancel takes effect from the next bar. The bias filter reads the previous session only. Limit fills start the bar after arming, and the strategy's orders also work from the next bar (`process_orders_on_close = false`).
- **FVG off-by-one.** The gap is between candle t−2's high and candle t's low, and it is confirmed at t's close. Its first candle must be at or after the sweep low. Checks for price trading back into it start the bar after it forms. The box is drawn from t−2.
- **Timezone / DST.** Killzones, the 16:00 flatten and the 18:00 restart all use `America/New_York`. A bar's killzone is decided by its open time.
- **Same-bar SL/TP.** The indicator counts a loss whenever a stop and a target trade in the same bar, including the breakeven stop on the TP1 bar. The strategy can't override TradingView's price path, and its header says so.
- **Checked by compiling.** Both files compile clean in TradingView's editor, and the pasted copies were hash-matched against these files. That compile pass caught one real error: the strategy's short title was over 10 characters.

## Limitations

- **Not run on a chart yet.** Runtime errors and real behaviour haven't been observed, because "Add to chart" needs a login. The first run is yours. If it errors, send me the message from the Pine console.
- **One FVG per setup.** The setup uses only the newest untouched FVG in the leg. An older, deeper gap that is still open is not considered.
- **OCO between directions.** One position at a time (assumption A9 in the indicator header) can occasionally skip a valid second-direction setup.
- **Market entry.** It fills at the arming bar's close in the indicator and at the next bar's open in the strategy.
- **Contract rounding.** The strategy uses whole contracts. With 1 contract and a 50% partial, the whole position exits at TP1.
- **Few trades.** A 60m CRT inside NY AM produces at most a few setups a day. Seven weeks of 5m data will not reach 100 trades.
