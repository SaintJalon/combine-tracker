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

  var api = { effectiveTarget: effectiveTarget, tomorrowCap: tomorrowCap, eodFloor: eodFloor, reviewDay: reviewDay };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CTRules = api;
})(this);
