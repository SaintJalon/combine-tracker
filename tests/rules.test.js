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

console.log('\n' + n + ' passed');
