// Run: node tests/rules.test.js — checks rules.js against the numbers from the Lucid Flex 25K dashboard.
const assert = require('assert');
const R = require('../rules.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

// 1. Consistency-adjusted target (Lucid Flex 25K: base $1,250, 50% consistency)
t('best day 1057, total 775 → target 2114, remaining 1339', () => {
  const T = R.effectiveTarget(1250, 1057, 0.5);
  assert.strictEqual(T, 2114);
  assert.strictEqual(T - 775, 1339);
});
t('two more +$500 days (total 1775) → remaining 339', () => {
  const best = Math.max(1057, 500, 500), total = 775 + 500 + 500;
  assert.strictEqual(R.effectiveTarget(1250, best, 0.5) - total, 339);
});
t('best day under the cap keeps the base target', () => {
  assert.strictEqual(R.effectiveTarget(1250, 400, 0.5), 1250);
});
t('no consistency rule keeps the base target', () => {
  assert.strictEqual(R.effectiveTarget(1250, 5000, 0), 1250);
});

// Tomorrow's cap: x <= total * pct / (1 - pct), never below the current best day
t('cap never below the current best day (total 775, best 1057)', () => {
  assert.strictEqual(R.tomorrowCap(775, 1057, 0.5), 1057);
});
t('cap = total*pct/(1-pct) once that is larger (total 1775, best 1057 → 1775)', () => {
  assert.strictEqual(R.tomorrowCap(1775, 1057, 0.5), 1775);
});
t('a day at the cap stays within 50% of the new total; a dollar more breaks it', () => {
  const total = 1775, best = 1057, cap = R.tomorrowCap(total, best, 0.5);
  assert.ok(cap <= (total + cap) * 0.5);
  assert.ok(cap + 1 > (total + cap + 1) * 0.5);
  // ...and at the cap the raised target is exactly the new total, so the target is still met
  assert.strictEqual(R.effectiveTarget(1250, cap, 0.5), total + cap);
});
t('40% rule: total 600, best 200 → cap 400', () => {
  assert.strictEqual(R.tomorrowCap(600, 200, 0.4), 400);
});
t('nothing banked yet → cap 0 (any profit sets the bar)', () => {
  assert.strictEqual(R.tomorrowCap(0, 0, 0.5), 0);
});

// 2. EOD trailing floor: closes 25,357.50 (10/12) and 24,718.50 (10/13), 25,776 intraday on 10/14
const days = [{ date: '2026-10-12', net: 357.5 }, { date: '2026-10-13', net: -639 }, { date: '2026-10-14', net: 1057.5 }];
const lucid = { size: 25000, maxloss: 1000, locks: true, lockOff: 0, days, today: '2026-10-14' };
t('before the close: floor $24,358, moves to $24,776 at close', () => {
  const f = R.eodFloor(Object.assign({ closed: false, balance: 25776 }, lucid));
  assert.strictEqual(f.floor, 24357.5);
  assert.strictEqual(Math.round(f.floor), 24358);
  assert.strictEqual(f.prospective, 24776);
});
t('after the 4:00 PM CT close today counts: floor $24,776', () => {
  const f = R.eodFloor(Object.assign({ closed: true, balance: 25776 }, lucid));
  assert.strictEqual(f.floor, 24776);
  assert.strictEqual(f.prospective, 24776);
});
t('balance defaults to start + every logged day', () => {
  assert.strictEqual(R.eodFloor(Object.assign({ closed: false }, lucid)).prospective, 24776);
});
t('lock at the initial trail balance still applies', () => {
  const big = [{ date: '2026-10-12', net: 1500 }, { date: '2026-10-13', net: 200 }];
  const f = R.eodFloor({ size: 25000, maxloss: 1000, locks: true, lockOff: 0, days: big, today: '2026-10-14', closed: false });
  assert.strictEqual(f.floor, 25000);
  const f2 = R.eodFloor({ size: 50000, maxloss: 2000, locks: true, lockOff: 100, days: [{ date: '2026-10-01', net: 3000 }], today: '2026-10-02', closed: false });
  assert.strictEqual(f2.floor, 50100);
});
t('a losing day never pulls the floor down', () => {
  const f = R.eodFloor({ size: 25000, maxloss: 1000, locks: false, days: [{ date: '2026-10-12', net: 500 }, { date: '2026-10-13', net: -800 }], today: '2026-10-14', closed: false });
  assert.strictEqual(f.floor, 24500);
});
// 3. Coach Co's review of a real trading day
const RULES = { stop: 400, dll: 1000, maxloss: 2000, cap: 4, consRaise: false };
const T = (p, o) => Object.assign({ p, qty: 1, s: 'ORB', mistakes: [] }, o);
t('a clean green day inside the rules scores 100', () => {
  const r = R.reviewDay({ net: 350, trades: [T(250), T(100)], followed: true }, RULES);
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.leaks, []);
  assert.deepStrictEqual(r.good, ['plan', 'in-cap', 'clean', 'green']);
});
t('over the daily stop, revenge (tag + size-up after a loser), moved stop, over the cap', () => {
  const r = R.reviewDay({ net: -520, trades: [T(-200), T(-150, { qty: 2 }), T(-100, { mistakes: ['Revenge', 'Moved stop'] }), T(-40), T(-30, { s: '' })] }, RULES);
  assert.deepStrictEqual(r.leaks.map(l => [l.k, l.n]), [['daily-stop', 1], ['over-cap', 1], ['revenge', 2], ['moved-stop', 1], ['no-setup', 1]]);
  assert.strictEqual(r.score, 100 - 25 - 10 - 20 - 10 - 5);
});
t('a max-loss breach replaces the daily-stop and DLL flags; a bare net still gets a read', () => {
  const r = R.reviewDay({ net: -2100, trades: [] }, RULES);
  assert.deepStrictEqual(r.leaks.map(l => l.k), ['max-loss']);
  assert.strictEqual(r.itemized, false);
});
t('a big day that raises the consistency target is flagged, and not called green', () => {
  const r = R.reviewDay({ net: 2400, trades: [T(2400)], followed: true }, Object.assign({}, RULES, { consRaise: true }));
  assert.deepStrictEqual(r.leaks.map(l => l.k), ['cons-raise']);
  assert.ok(r.good.indexOf('green') < 0);
});

// Today's plan
const base = { target: 450, stop: 400, dll: 1200, buffer: 2000, risk: 100, cap: 4, consCap: Infinity, stopPts: 10, pp: 20, microPp: 2, maxMini: 4, maxMicro: 40 };
t('today: daily stop is the tightest limit; $100 a trade → 4 losers to the stop, 5 MNQ at 10 pts', () => {
  const p = R.todayPlan(base);
  assert.strictEqual(p.lossLimit, 400); assert.strictEqual(p.limitBy, 'stop');
  assert.strictEqual(p.riskPerTrade, 100); assert.strictEqual(p.losses, 4);
  assert.strictEqual(p.micro, 5); assert.strictEqual(p.mini, 0); assert.strictEqual(p.ceiling, null);
});
t('today: thin buffer → half the buffer ($250) is the limit, so 2 losers at $100 end the day', () => {
  const p = R.todayPlan(Object.assign({}, base, { buffer: 500 }));
  assert.strictEqual(p.lossLimit, 250); assert.strictEqual(p.limitBy, 'buffer');
  assert.strictEqual(p.riskPerTrade, 100); assert.strictEqual(p.losses, 2);
});
t('today: firm limit tighter than your stop wins; half size halves risk but keeps the walk-away count', () => {
  const p = R.todayPlan(Object.assign({}, base, { dll: 300, sizeFactor: 0.5 }));
  assert.strictEqual(p.limitBy, 'dll'); assert.strictEqual(p.lossLimit, 300);
  assert.strictEqual(p.riskPerTrade, 50); assert.strictEqual(p.losses, 3); assert.strictEqual(p.micro, 2);
});
t('today: contracts respect the plan cap; consistency ceiling shows', () => {
  const p = R.todayPlan(Object.assign({}, base, { stop: 2000, buffer: 9000, risk: 1000, consCap: 1499.6, maxMini: 2 }));
  assert.strictEqual(p.mini, 2); assert.strictEqual(p.ceiling, 1500);
});
t('today: breached account → nothing to trade', () => {
  assert.strictEqual(R.todayPlan(Object.assign({}, base, { buffer: 0 })).breached, true);
});
// Pass odds
t('pass odds: seeded, repeatable, and half size survives more often', () => {
  const o = { winRate: 0.45, payoff: 1.5, risk: 200, buffer: 1000, goal: 2000, trades: 200, seed: 7 };
  const a = R.passOdds(o), b = R.passOdds(o), h = R.passOdds(Object.assign({}, o, { risk: 100 }));
  assert.deepStrictEqual(a, b); assert.ok(a.pass + a.ruin <= 100); assert.ok(h.ruin < a.ruin);
});
t('pass odds: no edge data → null; nothing left to make → 100%', () => {
  assert.strictEqual(R.passOdds({ winRate: 0, payoff: 1, risk: 1, buffer: 1, goal: 1 }), null);
  assert.deepStrictEqual(R.passOdds({ winRate: 0.5, payoff: 1, risk: 1, buffer: 1, goal: 0 }), { pass: 100, ruin: 0 });
});
// Weekday results
t('by weekday: Tuesdays and Fridays grouped with averages', () => {
  const w = R.byWeekday([{ date: '2026-10-13', net: 300 }, { date: '2026-10-16', net: -200 }, { date: '2026-10-20', net: 100 }, { date: '2026-10-23', net: -400 }]);
  assert.strictEqual(w[2].n, 2); assert.strictEqual(w[2].avg, 200); assert.strictEqual(w[5].net, -600); assert.strictEqual(w[5].wins, 0);
});
// Fastest clean path
t('fastest path: $3,000 left on a $3,000 target at 50% → 2 days of $1,500', () => {
  assert.deepStrictEqual(R.fastestPath({ remaining: 3000, target: 3000, pct: 0.5, minLeft: 0 }), { days: 2, perDay: 1500 });
});
t('fastest path: your realistic best day and the minimum days both stretch it', () => {
  assert.deepStrictEqual(R.fastestPath({ remaining: 3000, target: 3000, pct: 0.5, perDayMax: 700 }), { days: 5, perDay: 600 });
  assert.deepStrictEqual(R.fastestPath({ remaining: 500, target: 3000, pct: 0, minLeft: 3 }), { days: 3, perDay: 167 });
});

// Adaptive daily average
t('pace: on plan → plan average; ahead → less a day', () => {
  assert.deepStrictEqual(R.paceAdjust({ remaining: 3000, daysLeft: 10, base: 300, cap: 450 }), { perDay: 300, days: 10, extra: 0, status: 'on' });
  assert.strictEqual(R.paceAdjust({ remaining: 2000, daysLeft: 10, base: 300, cap: 450 }).status, 'ahead');
});
t('pace: a red day → behind but still under the cap, same days', () => {
  assert.deepStrictEqual(R.paceAdjust({ remaining: 3400, daysLeft: 9, base: 300, cap: 450 }), { perDay: 378, days: 9, extra: 0, status: 'behind' });
});
t('pace: too far behind → days are added so no day passes the cap', () => {
  assert.deepStrictEqual(R.paceAdjust({ remaining: 3600, daysLeft: 6, base: 300, cap: 450 }), { perDay: 450, days: 8, extra: 2, status: 'stretched' });
  assert.deepStrictEqual(R.paceAdjust({ remaining: 1000, daysLeft: 0, base: 300, cap: 450 }), { perDay: 334, days: 3, extra: 3, status: 'stretched' });
});
t('pace: nothing left → done', () => {
  assert.strictEqual(R.paceAdjust({ remaining: -50, daysLeft: 3, base: 300, cap: 450 }).status, 'done');
});

console.log('\n' + n + ' passed');
