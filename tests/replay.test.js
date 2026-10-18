// Run: node tests/replay.test.js — checks replay.js: CSV formats, CT time zones, CME sessions, candles and fills.
const assert = require('assert');
const R = require('../replay.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
const Z = (y, mo, d, H, M) => Date.UTC(y, mo - 1, d, H, M || 0) / 1000;
const NY = 'America/New_York';

// 1. Time zones and sessions
t('08:30 CT in winter is 14:30 UTC; in summer 13:30 UTC', () => {
  assert.strictEqual(R.zonedToUtc(2024, 1, 2, 8, 30, 0, R.CT), Z(2024, 1, 2, 14, 30));
  assert.strictEqual(R.zonedToUtc(2024, 7, 1, 8, 30, 0, R.CT), Z(2024, 7, 1, 13, 30));
});
t('the repeated 01:30 on fall-back day reads as the first (daylight) one', () => {
  assert.strictEqual(R.zonedToUtc(2024, 11, 3, 1, 30, 0, R.CT), Z(2024, 11, 3, 6, 30));
});
t('the hour after spring-forward reads right (03:00 CDT = 08:00 UTC)', () => {
  assert.strictEqual(R.zonedToUtc(2024, 3, 10, 3, 0, 0, R.CT), Z(2024, 3, 10, 8, 0));
});
t('Sunday 5:00 PM CT opens Monday\'s session; Monday 5:00 PM opens Tuesday\'s', () => {
  assert.strictEqual(R.sessionDay(Z(2024, 1, 7, 23, 0)), '2024-01-08');  // Sun 17:00 CT
  assert.strictEqual(R.sessionDay(Z(2024, 1, 8, 21, 59)), '2024-01-08'); // Mon 15:59 CT
  assert.strictEqual(R.sessionDay(Z(2024, 1, 8, 23, 0)), '2024-01-09');  // Mon 17:00 CT
});

// 2. CSV formats
t('TradingView export, unix seconds', () => {
  const r = R.parseCSV('time,open,high,low,close,Volume\n1704205800,16800,16810,16795,16805,1200\n1704205860,16805,16812,16801,16811,900\n');
  assert.deepStrictEqual(r.S.t, [1704205800, 1704205860]);
  assert.deepStrictEqual([r.S.o[0], r.S.h[0], r.S.l[0], r.S.c[0], r.S.v[0]], [16800, 16810, 16795, 16805, 1200]);
  assert.strictEqual(r.step, 60);
});
t('TradingView export, ISO time with an offset', () => {
  const r = R.parseCSV('time,open,high,low,close\n2024-01-02T08:30:00-06:00,1,2,0.5,1.5\n');
  assert.strictEqual(r.S.t[0], Z(2024, 1, 2, 14, 30));
});
t('NinjaTrader export: no header, semicolons, yyyyMMdd HHmmss read in CT', () => {
  const r = R.parseCSV('20240102 083000;16800.25;16810;16795.5;16805.75;1200\n20240102 083100;16805.75;16812;16801;16811;900');
  assert.strictEqual(r.S.t[0], Z(2024, 1, 2, 14, 30));
  assert.strictEqual(r.S.o[0], 16800.25);
  assert.strictEqual(r.S.t.length, 2);
});
t('Date + Time columns, US dates, read in ET', () => {
  const r = R.parseCSV('Date,Time,Open,High,Low,Close,Volume\n01/02/2024,09:30,10,11,9,10.5,5\n01/02/2024,9:31 AM,10.5,11,10,10.75,6', { tz: NY });
  assert.deepStrictEqual(r.S.t, [Z(2024, 1, 2, 14, 30), Z(2024, 1, 2, 14, 31)]);
});
t('MetaTrader <DTYYYYMMDD>,<TIME> with HHMMSS times', () => {
  const r = R.parseCSV('<TICKER>,<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>\nNQ,20240102,083000,1,2,0.5,1.5,7', { tz: R.CT });
  assert.strictEqual(r.S.t[0], Z(2024, 1, 2, 14, 30));
  assert.strictEqual(r.S.v[0], 7);
});
t('quoted thousands separators and a decimal comma (semicolon files)', () => {
  const a = R.parseCSV('time,open,high,low,close\n1704205800,"16,800.25","16,810","16,795","16,805"');
  assert.strictEqual(a.S.o[0], 16800.25);
  const b = R.parseCSV('Date;Open;High;Low;Close\n2024-01-02 08:30;16800,25;16810,5;16795;16805', { tz: R.CT });
  assert.strictEqual(b.S.o[0], 16800.25);
  assert.strictEqual(b.S.h[0], 16810.5);
});
t('Databento: nanosecond times, fixed-point prices, spreads dropped, front month per session', () => {
  const px = (p) => String(Math.round(p * 1e9));
  const ns = (s) => String(s) + '000000000';
  const rows = [
    // Mon 2024-03-11 session: NQH4 is front (more volume)
    [Z(2024, 3, 11, 14, 30), 'NQH4', 18000, 500], [Z(2024, 3, 11, 14, 30), 'NQM4', 18200, 50],
    [Z(2024, 3, 11, 14, 30), 'NQH4-NQM4', -200, 900],
    // Fri 2024-03-15 session: rolled to NQM4
    [Z(2024, 3, 15, 14, 30), 'NQH4', 18100, 40], [Z(2024, 3, 15, 14, 30), 'NQM4', 18300, 800]
  ];
  const csv = 'ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol\n' +
    rows.map(([ts, sym, p, v]) => [ns(ts), 33, 1, 1, px(p), px(p + 5), px(p - 5), px(p + 1), v, sym].join(',')).join('\n');
  const r = R.parseCSV(csv);
  assert.deepStrictEqual(r.S.t, [Z(2024, 3, 11, 14, 30), Z(2024, 3, 15, 14, 30)]);
  assert.deepStrictEqual(r.S.o, [18000, 18300]);
  assert.strictEqual(r.rolled, true);
});
t('unsorted rows sort, a repeated time keeps the later row, high/low are repaired', () => {
  const r = R.parseCSV('time,open,high,low,close\n120,5,6,4,5\n60,1,2,0,1\n120,7,6,8,9\n');
  assert.deepStrictEqual(r.S.t, [60, 120]);
  assert.deepStrictEqual([r.S.o[1], r.S.h[1], r.S.l[1], r.S.c[1]], [7, 9, 6, 9]);
});
t('unreadable rows are skipped and counted; a file with none throws', () => {
  const r = R.parseCSV('time,open,high,low,close\n60,1,2,0,1\nnot-a-time,1,2,0,1\n120,x,2,0,1\n');
  assert.strictEqual(r.S.t.length, 1);
  assert.strictEqual(r.skipped, 2);
  assert.throws(() => R.parseCSV('time,open,high,low,close\nbad,1,2,3,4'));
  assert.throws(() => R.parseCSV('time,open,close\n60,1,2'));
});

// 3. Series helpers
const ser = (rows) => ({ t: rows.map(r => r[0]), o: rows.map(r => r[1]), h: rows.map(r => r[2]), l: rows.map(r => r[3]), c: rows.map(r => r[4]), v: rows.map(r => r[5] || 0) });
t('merge: interleaves by time and the newer import wins on overlap', () => {
  const m = R.merge(ser([[60, 1, 1, 1, 1], [180, 3, 3, 3, 3]]), ser([[120, 2, 2, 2, 2], [180, 9, 9, 9, 9]]));
  assert.deepStrictEqual(m.t, [60, 120, 180]);
  assert.deepStrictEqual(m.c, [1, 2, 9]);
});
t('sessions split at 5:00 PM CT', () => {
  const S = ser([[Z(2024, 1, 7, 23, 0), 1, 1, 1, 1], [Z(2024, 1, 8, 14, 30), 1, 1, 1, 1], [Z(2024, 1, 8, 23, 0), 1, 1, 1, 1]]);
  assert.deepStrictEqual(R.sessions(S), [{ day: '2024-01-08', i0: 0, i1: 2 }, { day: '2024-01-09', i0: 2, i1: 3 }]);
});
t('5-minute candles build from 1-minute bars, the open candle growing bar by bar', () => {
  const base = Z(2024, 1, 2, 14, 30);
  const S = ser([[base, 10, 12, 9, 11, 1], [base + 60, 11, 15, 10, 14, 2], [base + 240, 14, 14, 8, 9, 3], [base + 300, 9, 10, 9, 10, 4]]);
  const c = R.aggregate(S, 0, 4, 300);
  assert.deepStrictEqual(c, [{ t: base, o: 10, h: 15, l: 8, c: 9, v: 6 }, { t: base + 300, o: 9, h: 10, l: 9, c: 10, v: 4 }]);
  const partial = R.aggregate(S, 0, 2, 300); // only two bars revealed: no look-ahead
  assert.deepStrictEqual(partial, [{ t: base, o: 10, h: 15, l: 9, c: 14, v: 3 }]);
});

// 4. Fills and P&L
const B = (o, h, l, c) => ({ o, h, l, c });
t('long: stop and target fill at their price inside the bar', () => {
  assert.deepStrictEqual(R.barExit('long', B(100, 101, 94, 95), 95, 110), { price: 95, why: 'stop' });
  assert.deepStrictEqual(R.barExit('long', B(100, 111, 99, 108), 95, 110), { price: 110, why: 'target' });
  assert.strictEqual(R.barExit('long', B(100, 105, 96, 104), 95, 110), null);
});
t('both levels inside one bar: the stop is assumed first', () => {
  assert.deepStrictEqual(R.barExit('long', B(100, 112, 93, 105), 95, 110), { price: 95, why: 'stop' });
  assert.deepStrictEqual(R.barExit('short', B(100, 107, 88, 95), 105, 90), { price: 105, why: 'stop' });
});
t('a gap through the stop fills at the open; a gap through the target gets the open too', () => {
  assert.deepStrictEqual(R.barExit('long', B(92, 93, 90, 91), 95, 110), { price: 92, why: 'stop' });
  assert.deepStrictEqual(R.barExit('short', B(85, 86, 84, 85), 105, 90), { price: 85, why: 'target' });
});
t('no stop or target set: never exits', () => {
  assert.strictEqual(R.barExit('long', B(100, 200, 1, 100), null, null), null);
});
t('buy limit: fills at its price only when traded through by a tick; a gap down fills at the open', () => {
  assert.strictEqual(R.limitFill('long', B(100, 101, 95, 96), 95, 0.25), null);      // touch only
  assert.strictEqual(R.limitFill('long', B(100, 101, 94.75, 96), 95, 0.25), 95);     // a tick through
  assert.strictEqual(R.limitFill('long', B(93, 94, 92, 93), 95, 0.25), 93);          // opened below
});
t('sell limit mirrors it', () => {
  assert.strictEqual(R.limitFill('short', B(100, 105, 99, 104), 105, 0.25), null);
  assert.strictEqual(R.limitFill('short', B(100, 105.25, 99, 104), 105, 0.25), 105);
  assert.strictEqual(R.limitFill('short', B(107, 108, 106, 107), 105, 0.25), 107);
});
t('daily-stop price: NQ long, $400 room → 20 points; off-tick rounds to the next tick beyond', () => {
  assert.strictEqual(R.lossLimitPrice('long', 17000, 1, 20, 400, 0.25), 16980);
  assert.strictEqual(R.lossLimitPrice('long', 17000, 1, 20, 403, 0.25), 16979.75);
  assert.strictEqual(R.lossLimitPrice('short', 17000, 1, 20, 403, 0.25), 17020.25);
  assert.strictEqual(R.lossLimitPrice('long', 17000, 2, 20, 400, 0.25), 16990);
});
t('trade net: points × $/pt × qty minus round-turn fees', () => {
  assert.strictEqual(R.tradeNet('long', 17000, 17010, 2, 20, 4), 392);
  assert.strictEqual(R.tradeNet('short', 5000, 5002.5, 1, 50, 0), -125);
});
t('summary: wins, losses, win rate, profit factor', () => {
  const s = R.summarize([{ net: 300 }, { net: -100 }, { net: -100 }, { net: 0 }]);
  assert.deepStrictEqual([s.n, s.wins, s.losses, s.net, s.best, s.worst], [4, 1, 2, 100, 300, -100]);
  assert.strictEqual(s.winRate, 0.25);
  assert.strictEqual(s.pf, 1.5);
});

// 5. Data providers
t('Databento query: a bare root is the continuous front month, the window opens 17:00 CT the evening before', () => {
  const q = R.databentoQuery('nq', '2024-03-11', '2024-03-15');
  assert.deepStrictEqual(q, { dataset: 'GLBX.MDP3', schema: 'ohlcv-1m', symbols: 'NQ.c.0', stype_in: 'continuous',
    start: '2024-03-10T22:00:00Z', end: '2024-03-15T21:00:00Z' }); // Sun 17:00 CDT → Fri 16:00 CDT
  assert.strictEqual(R.databentoQuery('ES.v.1', '2024-01-02', '2024-01-02').symbols, 'ES.v.1');
  assert.strictEqual(R.databentoQuery('ES.FUT', '2024-01-02', '2024-01-02').stype_in, 'parent');
  assert.strictEqual(R.databentoQuery('NQH4', '2024-01-02', '2024-01-02').stype_in, 'raw_symbol');
  assert.strictEqual(R.databentoQuery('NQ', '2024-01-02', '2024-01-02').start, '2024-01-01T23:00:00Z'); // 17:00 CST
});
t('Massive aggregates → sorted series in seconds, duplicates dropped', () => {
  const S = R.massiveToSeries([{ t: 1704205860000, o: 2, h: 3, l: 1, c: 2.5, v: 10 }, { t: 1704205800000, o: 1, h: 2, l: 0.5, c: 2, v: 5 }, { t: 1704205800000, o: 9, h: 9, l: 9, c: 9 }]);
  assert.deepStrictEqual(S.t, [1704205800, 1704205860]);
  assert.deepStrictEqual(S.c, [2, 2.5]);
});
t('symbol roots', () => {
  assert.deepStrictEqual(['NQ.c.0', 'MNQH4', 'mnqh24', 'ES.FUT', 'NQ', 'QQQ'].map(R.symbolRoot), ['NQ', 'MNQ', 'MNQ', 'ES', 'NQ', 'QQQ']);
});

// 6. Coach Co's sparring review
const TR = (o) => Object.assign({ side: 'long', qty: 1, entry: 100, exit: 101, tIn: 0, tOut: 60, why: 'target', net: 20, r: 1, mfe: 1, mae: 0, stop0: 99 }, o);
t('a clean session scores 100 with its strengths named', () => {
  const r = R.reviewSession({ trades: [TR({ r: 2.5, exit: 102.5, net: 50 }), TR({ tIn: 600, tOut: 700, net: -20, r: -1, exit: 99, why: 'stop' })], rules: { cap: 4 }, followed: true });
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.leaks, []);
  assert.deepStrictEqual(r.good.map(g => g.k), ['all-stops', 'calm', 'runner']);
});
t('leaks: no stop, revenge re-entry, size-up after a loss, loser past 1.2R, winner cut early, daily stop', () => {
  const r = R.reviewSession({ locked: true, rules: { cap: 4 }, trades: [
    TR({ net: -20, r: -1, exit: 99, why: 'stop', tOut: 60 }),
    TR({ tIn: 120, tOut: 300, qty: 2, stop0: null, r: null, net: -100, exit: 97.5, why: 'market' }),     // revenge + size-up + no stop
    TR({ tIn: 1000, tOut: 1100, r: -1.5, net: -30, exit: 98.5, why: 'stop' }),                            // deep
    TR({ tIn: 2000, tOut: 2100, why: 'market', exit: 100.5, net: 10, r: 0.5, mfe: 2 })                    // cut winner
  ] });
  assert.deepStrictEqual(r.leaks.map(l => l.k), ['daily-stop', 'no-stop', 'revenge', 'size-up', 'deep-loss', 'cut-winner']);
  assert.strictEqual(r.score, 100 - 25 - 10 - 10 - 15 - 10 - 5);
});
t('no trades reads as sitting out, not as a fault', () => {
  assert.deepStrictEqual(R.reviewSession({ trades: [] }), { score: 100, leaks: [], good: [{ k: 'sat-out', n: 1 }] });
});
t('log review: trend, most repeated leak, setups and hours with 3+ trades, break-even win rate', () => {
  const at = (h) => Date.UTC(2024, 0, 10, h + 6, 5) / 1000; // h:05 CT in January
  const good = { trades: [TR({ setup: 'ORB', tIn: at(8), r: 2, net: 40 }), TR({ setup: 'ORB', tIn: at(8), r: 2, net: 40 }), TR({ setup: 'ORB', tIn: at(8), r: -1, net: -20, why: 'stop' })] };
  const bad = { trades: [TR({ setup: 'Fade', tIn: at(10), stop0: null, r: null, net: -50 }), TR({ setup: 'Fade', tIn: at(10), r: -1, net: -20 }), TR({ setup: 'Fade', tIn: at(10), r: -1, net: -20 })] };
  const L = [good, good, good, bad, bad, bad]; // newest first: recent sessions are the good ones
  const r = R.reviewLog(L);
  assert.strictEqual(r.n, 6);
  assert.ok(r.recent > r.prior);
  assert.deepStrictEqual(r.leaks[0], { k: 'no-stop', sessions: 3 });
  assert.deepStrictEqual(r.setups.map(x => [x.k, x.n]), [['ORB', 9], ['Fade', 9]]);
  assert.deepStrictEqual(r.hours.map(x => x.k), [8, 10]);
  assert.ok(Math.abs(r.breakEven - 1 / 3) < 1e-9); // avg win 2R, avg loss 1R
});

// 7. Stats by setup and entry type
t('by setup: rows best first, each split into market / limit / not recorded', () => {
  const rows = R.bySetup([
    TR({ setup: 'ORB', how: 'limit', net: 100, r: 2 }), TR({ setup: 'ORB', how: 'limit', net: -50, r: -1 }),
    TR({ setup: 'ORB', how: 'market', net: -50, r: -1 }), TR({ setup: 'Fade', net: -20, r: -1 }), TR({ setup: '', how: 'market', net: 5, r: null })
  ]);
  assert.deepStrictEqual(rows.map(x => [x.k, x.n, x.net]), [['(no setup)', 1, 5], ['ORB', 3, 0], ['Fade', 1, -20]]);
  const orb = rows[1];
  assert.deepStrictEqual(orb.entries.map(e => [e.k, e.n, e.wins, e.net, e.avgR]), [['market', 1, 0, -50, -1], ['limit', 2, 1, 50, 0.5]]);
  assert.deepStrictEqual(rows[2].entries.map(e => e.k), ['unknown']); // logged before entry types were recorded
});
t('log review compares entry types once each has 3+ trades', () => {
  const s1 = { trades: [TR({ how: 'limit', net: 40 }), TR({ how: 'limit', net: 40 }), TR({ how: 'limit', net: -20 }), TR({ how: 'market', net: -20 }), TR({ how: 'market', net: -20 }), TR({ how: 'market', net: 10 })] };
  const r = R.reviewLog([s1]);
  assert.deepStrictEqual(r.entries.map(e => [e.k, e.n, Math.round(e.per)]), [['limit', 3, 20], ['market', 3, -10]]);
});

// 8. Excel (.xlsx) exports read like CSVs (async: unzipping uses DecompressionStream)
(async () => {
  const fs = require('fs'), path = require('path');
  const read = (f) => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
  async function ta(name, fn) { await fn(); n++; console.log('ok  ' + name); }
  const first = Z(2024, 1, 2, 14, 30); // 08:30 CT
  for (const [f, tz] of [['tv-datetime.xlsx', R.CT], ['tv-unix.xlsx', R.CT], ['iso-text.xlsx', 'UTC'], ['date-time-cols.xlsx', R.CT]]) {
    await ta('xlsx: ' + f, async () => {
      const buf = read(f);
      assert.ok(R.isXlsx(buf));
      const r = R.parseCSV(await R.xlsxToCSV(buf), { tz });
      assert.deepStrictEqual(r.S.t, [first, first + 60, first + 120]);
      assert.deepStrictEqual([r.S.o[0], r.S.h[0], r.S.l[0], r.S.c[0]], [16800, 16810, 16795, 16805.25]);
    });
  }
  await ta('a CSV is not mistaken for xlsx', async () => {
    assert.ok(!R.isXlsx(new TextEncoder().encode('time,open\n').buffer));
  });
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
