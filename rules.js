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

  var api = { effectiveTarget: effectiveTarget, tomorrowCap: tomorrowCap, eodFloor: eodFloor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CTRules = api;
})(this);
