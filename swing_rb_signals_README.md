# SaintTrades Swing Rejection Blocks + Signals

**`SaintTrades-SwingRB-Signals.pine`** (Pine Script v6 indicator) draws swing-point rejection blocks the way [Rejection Blocks [Taking Prophets]](https://www.tradingview.com/script/vLCn589x-Rejection-Blocks-Taking-Prophets/) describes them. On top of the blocks it adds **BUY / SELL signals**, each with a stop and a target, plus alerts and a scorecard showing how the signals did on your chart.

The Taking Prophets script is protected source, so its code can't be seen or copied. This version is rebuilt from its published description:

| Their description | Here |
|---|---|
| Reversal zones where wicks dominate around major swing points | Swing highs/lows (swing strength input), with the wick ≥ body × ratio |
| Only candles whose wick is significantly larger than the body | **Rejecting wick ≥ body ×**, default 2 |
| Blocks extend into the future | Blocks run to the current bar plus 10 bars |
| Invalidated blocks are deleted (mitigation) | Deleted on a close past the wick tip, or optionally any wick past it |
| Optional 50% midline | **50% midline**, on by default |

How it compares with **`SaintTrades-RejectionBlock.pine`**: that one is the full ICT / Powell model, with key opens, liquidity sweeps, grades and three entry types. This one is the simpler swing-point version, with one clear signal per block.

## The rules

1. **Swing.** A swing high is the highest high of N candles on each side (default N = 3). It's only known N candles later, so the block appears then. Swing lows are the mirror.
2. **Block.** A swing-high candle whose **upper wick is at least 2× its body** gives a **bearish** block, drawn from the body top to the high. A swing-low candle whose **lower wick is at least 2× its body** gives a **bullish** block, drawn from the low to the body bottom. The dashed line is 50% of the wick.
3. **Mitigated** when a candle closes past the wick tip. The block is then deleted.
4. **Signals.** Each block gives one signal at most:
   - **BUY**: price trades down into a bullish block, and the candle closes back **above** the block. Entry = that close.
   - **SELL**: price trades up into a bearish block, and the candle closes back **below** it. Entry = that close.
   - **Stop** = the wick tip, plus 2 ticks of buffer. **Target** = 2R (twice the entry-to-stop distance).
   - With **Signal when = 50% touch**, the entry is instead a limit at the block's 50% line.
5. Signals print only after the candle closes. They never repaint.

## Install

Pine Editor → paste `SaintTrades-SwingRB-Signals.pine` → **Save** → **Add to chart**. After any code change, remove the indicator from the chart and add it again.

## Reading the chart

- **Green / red boxes** = bullish / bearish rejection blocks. Dashed line = 50%.
- **BUY / SELL** labels mark the signal candle. Hover a label to see the entry, stop, target and block.
- **Entry (blue), Stop (red), Target (green)** lines show the latest signal. Their prices are at the right edge. The lines stop where the trade ended.
- **Scorecard** (top right): signals, closed trades, win % and average R for buys, sells and both. The bottom row shows the latest signal and whether it's open, won or lost.

At a 2R target, a strategy breaks even at a 33% win rate. Judge it by **Avg R**: above +0R means the signals made money on this chart. Below 0 means they lost.

## Inputs

**1 · Rejection blocks**
| Input | Default | What it does |
|---|---|---|
| Swing strength | 3 | Candles on each side a swing must beat. Higher = fewer, more major swings. |
| Rejecting wick ≥ body × | 2.0 | How dominant the wick must be. Raise it for fewer, cleaner blocks. |
| Rejecting wick ≥ ATR(14) × | 0 (off) | Ignores small wicks. 0.25–0.5 is a good start on NQ. |
| Mitigated when | Close past tip | Or **Wick past tip** (stricter). |
| Live blocks kept per side | 5 | The oldest is dropped first. |
| Mitigated blocks kept (dimmed) | 0 | 0 = delete on mitigation, like the original. |
| 50% midline / Extend right | on / 10 bars | |

**2 · Buy / sell signals**
| Input | Default | What it does |
|---|---|---|
| BUY / SELL signals | on | Off = blocks only. |
| Signal when | Rejection close | Or **50% touch** (limit at the midline). |
| Stop buffer | 2 ticks | Past the wick tip. 4 ticks = 1 NQ point. |
| Target (R) | 2.0 | |
| Only trade with the EMA trend | off, 200 | BUY only above the EMA, SELL only below it. |
| Signal hours (New York time) | 0000-0000 (all) | e.g. `0930-1600` for the NY cash session. |
| Entry / stop / target lines | on | For the latest signal. |

## Alerts

On the chart: **Alerts (⏰) → Condition: ST Swing RB**, then pick one:

| Alert | Fires when |
|---|---|
| **Any alert() function call** | A signal prints. The message includes the entry, stop and target. **Best choice.** |
| BUY signal / SELL signal / BUY or SELL signal | A signal prints (ticker and price only). |
| New rejection block | A block is drawn. |

Set the frequency to **Once per bar close**.

## Finding settings that work on your market

1. Load NQ1! or MNQ1! on the 5m chart with as much history as your plan allows.
2. Read the scorecard. Don't trust it under about **100 closed trades**.
3. Change one input at a time and keep a change only if **Avg R** improves. Good ones to try: the EMA trend filter, signal hours `0930-1600`, swing strength 5, wick ATR × 0.25.
4. Check your final settings on a *different* date range from the one you tuned on. Settings that only work where you tuned them are curve-fit.

## What was checked

- **Syntax** passes the `pynescript` parser.
- **Runs end to end in PineTS** (an open-source Pine v6 runtime) with no runtime errors: 13 input combinations, each on three 3,000-bar random price series.
- **Known-answer scenarios** (hand-calculated first, tick = 0.25):

  | Scenario | Result |
  |---|---|
  | Swing high: open 99, close 98, high 104 | Bearish block 99–104, 50% at 101.5, shown 3 bars after the wick |
  | Retest closes 98, back below the block | SELL 98 · stop 104.5 · target 85 · won when 85 traded |
  | Bullish mirror | BUY 102 · stop 95.5 · target 115 |
  | 50% touch | SELL 101.5 · target 95.5. The target is not counted on the fill bar; it won on the next bar. |
  | 50% touch, same bar trades through the stop | Loss on the fill bar |
  | Close past the tip | Block deleted, no signal |
  | Wick past the tip, close back inside | Close mode keeps the block; wick mode deletes it |
  | Stop and target in the same bar | Counted as a loss |
  | Wick 1.5× body | No block |
  | One bar taps a bull block and a bear block | No signal. The next bar's clean SELL still fires. |

- **Filters.** No EMA-filtered signal sat on the wrong side of the EMA. With signal hours set to 09:30–16:00, no signal fell outside them.
- **No fake edge.** On random prices, the 2R signals won 26–35% of the time, around the 33% breakeven. That is what an honest indicator shows when there's no pattern to find.

## Limitations

- **Not compiled in TradingView yet.** TradingView was blocked in this environment, so the script hasn't run on a real chart. If the Pine Editor shows an error, send me the message and line number.
- **PineTS ignores session times**, so the signal-hours input was tested with an equivalent hour/minute check. The indicator itself uses TradingView's standard `time(timeframe.period, session, timezone)`.
- **Not a copy of the Taking Prophets code.** The wick ratio, swing strength and mitigation defaults are the closest match to their description. Their exact numbers aren't published.
- **Signals are not a guarantee.** The scorecard counts a fill at the signal price, with no slippage or commission.
