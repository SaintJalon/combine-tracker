// Prop-firm math shared by index.html and tests/rules.test.js — pure functions, no DOM, no app state.
(function (root) {
  // Consistency rule: no single day may be more than pct of total profit. Firms like Lucid don't fail
  // you for a big day; the profit target rises until that day fits: max(base, bestDay / pct).
  function effectiveTarget(base, bestDay, pct) {
    if (!(pct > 0) || !(bestDay > 0)) return base;
    return Math.max(base, Math.round(bestDay / pct * 100) / 100);
  }

  // The most you can make tomorrow without raising the target again. A day x stays within the cap
  // while x <= (total + x) * pct, i.e. x <= total * pct / (1 - pct) — and a day no bigger than the
  // current best day never moves the target, so the cap is never below it.
  function tomorrowCap(total, bestDay, pct) {
    if (!(pct > 0) || pct >= 1) return Infinity;
    return Math.max(0, total * pct / (1 - pct), bestDay > 0 ? bestDay : 0);
  }

  // End-of-day trailing floor. The floor trails the highest CLOSING balance, so only finished days
  // count: any day before today, or today once the session has closed. o = {
  //   size, maxloss, locks, lockOff,           plan rules (locks: floor stops at size + lockOff)
  //   days: [{date, net}],                      in date order; undated days count as finished
  //   today, closed,                            ISO date; has today's session closed?
  //   balance                                   live balance now (defaults to size + every net)
  // } → { floor, prospective, hwm }: floor = where it sits now; prospective = where it moves at the
  // close if the day ends at `balance` (equal to floor once the session has closed).
  function eodFloor(o) {
    var run = 0, hwm = o.size;
    (o.days || []).forEach(function (x) {
      run += x.net;
      var finished = !x.date || x.date < o.today || (x.date === o.today && o.closed);
      if (finished && o.size + run > hwm) hwm = o.size + run;
    });
    var balance = o.balance != null ? o.balance : o.size + run;
    function clamp(h) { var trail = h - o.maxloss; return o.locks ? Math.min(o.size + (o.lockOff || 0), trail) : trail; }
    var floor = clamp(hwm), prospective = o.closed ? floor : clamp(Math.max(hwm, balance));
    return { floor: floor, prospective: prospective, hwm: hwm };
  }

  // Coach Co's review of one real trading day. day = { net, trades: [{ p, qty, s, mistakes }], followed }
  // (a day logged as a bare net has no trades); r = { stop, dll, maxloss, cap, consRaise } — consRaise:
  // this day's size raised the consistency-adjusted target. → { score 0–100, leaks (worst first), good }.
  function reviewDay(day, r) {
    var T = day.trades || [], net = +day.net || 0, leaks = [], good = [], score = 100;
    function leak(k, n, pen) { if (n > 0) { leaks.push({ k: k, n: n }); score -= pen; } }
    function tagged(names) { var n = 0; T.forEach(function (t) { (t.mistakes || []).forEach(function (m) { if (names.indexOf(m) >= 0) n++; }); }); return n; }
    var sizeUp = 0;
    for (var i = 1; i < T.length; i++) {
      var prev = parseFloat(T[i - 1].p), q0 = parseFloat(T[i - 1].qty), q1 = parseFloat(T[i].qty);
      if (prev < 0 && q1 > q0) sizeUp++;
    }
    var maxBreach = r.maxloss > 0 && net <= -r.maxloss;
    leak('max-loss', maxBreach ? 1 : 0, 40);
    leak('daily-stop', !maxBreach && r.stop > 0 && net <= -r.stop ? 1 : 0, 25);
    leak('dll', !maxBreach && r.dll > 0 && net <= -r.dll && !(r.stop > 0 && net <= -r.stop) ? 1 : 0, 15);
    leak('over-cap', r.cap > 0 ? Math.max(0, T.length - r.cap) : 0, Math.min(20, Math.max(0, T.length - (r.cap || 0)) * 10));
    var revenge = tagged(['Revenge']) + sizeUp;
    leak('revenge', revenge, Math.min(30, revenge * 10));
    var moved = tagged(['Moved stop']); leak('moved-stop', moved, Math.min(20, moved * 10));
    leak('oversized', tagged(['Oversized']), 10);
    var chase = tagged(['Chased', 'FOMO', 'Late entry', 'Early entry']); leak('chase', chase, Math.min(15, chase * 5));
    var noSetup = tagged(['No setup']) + T.filter(function (t) { return !String(t.s || '').trim() && (t.mistakes || []).indexOf('No setup') < 0; }).length;
    leak('no-setup', noSetup, Math.min(15, noSetup * 5));
    var early = tagged(['Early exit']); leak('early-exit', early, Math.min(10, early * 5));
    leak('cons-raise', r.consRaise ? 1 : 0, 10);
    if (day.followed) good.push('plan');
    if (T.length && r.cap > 0 && T.length <= r.cap) good.push('in-cap');
    if (T.length && !leaks.some(function (l) { return ['revenge', 'moved-stop', 'oversized', 'chase', 'no-setup', 'early-exit'].indexOf(l.k) >= 0; })) good.push('clean');
    if (net > 0 && !r.consRaise) good.push('green');
    return { score: Math.max(0, score), leaks: leaks, good: good, itemized: T.length > 0 };
  }

  // Today's plan: the numbers for the next session, from the account's own rules. o = {
  //   target, stop, dll, buffer, risk, cap,   today's plan target · your daily stop · the firm's daily loss limit
  //                                           (0 = none) · room above the floor · base risk a trade · trade cap
  //   consCap,                                biggest day that keeps consistency clean (Infinity = no rule)
  //   stopPts, pp, microPp, maxMini, maxMicro, stop distance (points) and $/point for the mini and micro,
  //                                           plan contract caps (null = no cap)
  //   sizeFactor                              1 = normal, 0.5 = half size (Coach Co's call)
  // } → { breached, lossLimit, limitBy ('stop'|'dll'|'buffer'), riskPerTrade, losses, trades, mini, micro, ceiling }
  // The day's loss limit is the tightest of your stop, the firm's limit and half of what's left above the floor —
  // so one bad day can never end the account. Each trade risks at most half of it, so it takes two losers to stop.
  function todayPlan(o) {
    var buffer = +o.buffer || 0;
    if (buffer <= 0) return { breached: true, lossLimit: 0, limitBy: 'buffer', riskPerTrade: 0, losses: 0, trades: 0, mini: 0, micro: 0, ceiling: null, target: 0 };
    var opts = [];
    if (o.stop > 0) opts.push({ k: 'stop', v: o.stop });
    if (o.dll > 0) opts.push({ k: 'dll', v: o.dll });
    opts.push({ k: 'buffer', v: Math.floor(buffer / 2) });
    opts.sort(function (a, b) { return a.v - b.v || (a.k === 'stop' ? -1 : b.k === 'stop' ? 1 : 0); });
    var lim = opts[0], f = o.sizeFactor > 0 ? Math.min(1, o.sizeFactor) : 1;
    var risk = Math.min((+o.risk || lim.v / 2) * f, lim.v / 2);
    risk = Math.max(0, Math.floor(risk / 5) * 5) || Math.max(1, Math.floor(risk));
    // half size keeps the same walk-away count: it trims the day's loss instead of buying more attempts
    var full = Math.min(+o.risk || lim.v / 2, lim.v / 2), losses = Math.max(1, Math.floor(lim.v / Math.max(1, full) + 1e-9));
    if (o.cap > 0) losses = Math.min(losses, o.cap);
    function n(pp, max) { if (!(o.stopPts > 0) || !(pp > 0)) return null; var k = Math.floor(risk / (o.stopPts * pp) + 1e-9); return max != null ? Math.min(k, max) : k; }
    var ceiling = o.consCap > 0 && isFinite(o.consCap) ? Math.round(o.consCap) : null;
    return { breached: false, lossLimit: lim.v, limitBy: lim.k, riskPerTrade: risk, losses: losses, trades: o.cap > 0 ? o.cap : null,
      mini: n(o.pp, o.maxMini), micro: n(o.microPp, o.maxMicro), ceiling: ceiling, target: Math.max(0, Math.round(+o.target || 0)) };
  }

  // Odds of reaching the goal before the buffer is gone, trading a fixed risk per trade.
  // o = { winRate (0–1), payoff (avg win ÷ avg loss), risk, buffer, goal, trades (max trades left), sims, seed }
  // → { pass, ruin } as whole percents. Seeded, so the same inputs always give the same answer on screen.
  function passOdds(o) {
    if (!(o.winRate > 0) || !(o.payoff > 0) || !(o.risk > 0) || !(o.buffer > 0)) return null;
    if (!(o.goal > 0)) return { pass: 100, ruin: 0 };
    var sims = o.sims || 2000, seed = (o.seed || 1) >>> 0, pass = 0, ruin = 0, i, s, bal;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (s = 0; s < sims; s++) {
      bal = 0;
      for (i = 0; i < (o.trades || 200); i++) {
        bal += rnd() < o.winRate ? o.risk * o.payoff : -o.risk;
        if (bal >= o.goal) { pass++; break; }
        if (-bal >= o.buffer) { ruin++; break; }
      }
    }
    return { pass: Math.round(pass / sims * 100), ruin: Math.round(ruin / sims * 100) };
  }

  // Results by weekday. days = [{ date: 'YYYY-MM-DD', net }] → { 1: {n, net, avg, wins}, … } (0 = Sunday)
  function byWeekday(days) {
    var out = {};
    (days || []).forEach(function (x) {
      if (!x.date) return;
      var p = x.date.split('-'), w = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
      var g = out[w] || (out[w] = { n: 0, net: 0, wins: 0 });
      g.n++; g.net += +x.net || 0; if (x.net > 0) g.wins++;
    });
    Object.keys(out).forEach(function (k) { out[k].avg = out[k].net / out[k].n; });
    return out;
  }

  // The fastest path to the target that keeps consistency clean: equal days, each no bigger than
  // pct × target (the rule is checked on the final total), never fewer than the minimum days left.
  // o = { remaining, target, pct (0 = no rule), minLeft, perDayMax (optional: your realistic best day) }
  // → { days, perDay } (days = 0 once the target is in and the minimum met)
  function fastestPath(o) {
    var rem = Math.max(0, +o.remaining || 0), minLeft = Math.max(0, o.minLeft || 0);
    if (!rem) return { days: minLeft, perDay: 0 };
    var cap = o.pct > 0 ? o.pct * o.target : Infinity;
    if (o.perDayMax > 0) cap = Math.min(cap, o.perDayMax);
    var days = isFinite(cap) && cap > 0 ? Math.ceil(rem / cap - 1e-9) : 1;
    days = Math.max(days, minLeft, 1);
    return { days: days, perDay: Math.ceil(rem / days) };
  }

  var api = { effectiveTarget: effectiveTarget, tomorrowCap: tomorrowCap, eodFloor: eodFloor, reviewDay: reviewDay,
    todayPlan: todayPlan, passOdds: passOdds, byWeekday: byWeekday, fastestPath: fastestPath };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CTRules = api;
})(this);
