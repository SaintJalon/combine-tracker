// Bar-replay math shared by index.html and tests/replay.test.js — pure functions, no DOM, no app state.
// Times are unix seconds (UTC). "CT" is America/Chicago, the clock the rest of the app runs on.
// A bar series is columnar — {t, o, h, l, c, v} arrays (plain or Float64Array) of equal length — so a
// year of 1-minute bars stores and clones cheaply; bar(S, i) pulls one out as an object.
(function (root) {
  var CT = 'America/Chicago';

  // ---- time zones ----
  var fmts = {}, offs = {};
  function wallAt(ms, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) / 1000;
  }
  // Seconds to add to a UTC time to get the wall-clock time in tz. Offsets only change on the hour,
  // so they're cached per UTC hour: a year of 1-minute bars needs ~9k lookups, not 350k.
  function tzOffset(t, tz) {
    var h = Math.floor(t / 3600), k = tz + '|' + h, v = offs[k];
    if (v === undefined) v = offs[k] = wallAt(h * 3600000, tz) - h * 3600;
    return v;
  }
  // Wall-clock fields in tz → UTC seconds. In the repeated hour when clocks fall back it picks the
  // first (daylight) one; a time skipped by spring-forward lands an hour early.
  function zonedToUtc(y, mo, d, H, M, S, tz) {
    var guess = Date.UTC(y, mo - 1, d, H || 0, M || 0, S || 0) / 1000;
    return guess - tzOffset(guess - tzOffset(guess, tz), tz);
  }
  // Wall-clock seconds in CT (read them back with getUTC*). The chart is fed these so its axis shows CT.
  function ctWall(t) { return t + tzOffset(t, CT); }
  function isoOfWall(w) { return new Date(w * 1000).toISOString().slice(0, 10); }
  // CME Globex trades 5:00 PM CT → 4:00 PM CT and names each session for the day it ends, so
  // Sunday-evening bars belong to Monday. Shifting by 7h maps 17:00 CT onto the next midnight.
  // Stock and RTH-only files never cross 17:00 CT, so they keep their calendar date.
  function sessionDay(t) { return isoOfWall(ctWall(t) + 7 * 3600); }

  // ---- CSV import ----
  var COLS = {
    t: ['time', 'timestamp', 'datetime', 'date time', 'date_time', 'datetime utc', 'ts_event', 'ts', 'gmt time', 'local time', 'bar time'],
    date: ['date', 'day', 'dtyyyymmdd'],
    clock: ['time', 'hour'],
    o: ['open', 'o', 'first', 'open price'],
    h: ['high', 'h', 'max', 'high price'],
    l: ['low', 'l', 'min', 'low price'],
    c: ['close', 'c', 'last', 'close price', 'price'],
    v: ['volume', 'vol', 'v', 'total volume', 'tickvol', 'tick volume'],
    sym: ['symbol', 'ticker', 'raw_symbol', 'instrument', 'contract']
  };
  function colName(s) { return String(s).toLowerCase().replace(/[<>"']/g, '').replace(/\s+/g, ' ').trim(); }
  function findCol(names, list) {
    for (var i = 0; i < list.length; i++) { var j = names.indexOf(list[i]); if (j >= 0) return j; }
    return -1;
  }
  function splitLine(line, d) {
    if (line.indexOf('"') < 0) return line.split(d);
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === d && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // A time cell → UTC seconds (a number) when the cell pins it down — epoch numbers, ISO with Z or an
  // offset — or wall-clock fields [y, mo, d, H, M, S] for the caller to place in the file's time zone.
  function okDate(y, mo, d) { return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31; }
  function offsetSec(z) {
    if (!z || /^(z|utc|gmt)$/i.test(z)) return 0;
    var m = /([+-])(\d{2}):?(\d{2})/.exec(z);
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60) : 0;
  }
  function parseStamp(s) {
    s = String(s).trim();
    var m;
    if (/^\d+(\.\d+)?$/.test(s)) {
      var digits = s.split('.')[0], n = +s;
      if (digits.length === 8 || digits.length === 12 || digits.length === 14) {
        m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(digits);
        if (m && okDate(+m[1], +m[2], +m[3])) return [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
      }
      if (digits.length <= 10) return n;           // seconds
      if (digits.length <= 13) return n / 1e3;     // milliseconds
      if (digits.length <= 16) return n / 1e6;     // microseconds
      return Math.floor(n / 1e9);                  // nanoseconds (Databento)
    }
    // 2024-01-02T08:30:00Z · 2024-01-02 08:30:00-06:00 · 2024.01.02 08:30 (MetaTrader) · 20240102 083000 (NinjaTrader)
    m = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})(?:[T ]+(\d{1,2}):?(\d{2}):?(\d{2})?(?:[.,]\d+)?)?\s*(Z|UTC|GMT|(?:UTC|GMT)?\s*[+-]\d{2}:?\d{2})?$/i.exec(s);
    if (m && okDate(+m[1], +m[2], +m[3])) return fields(+m[1], +m[2], +m[3], m[4], m[5], m[6], null, m[7]);
    // 01/02/2024 8:30 AM (US)
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([AP]M)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i.exec(s);
    if (m) return fields(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1], +m[2], m[4], m[5], m[6], m[7], m[8]);
    // 02.01.2024 08:30:00.000 GMT-0600 (Dukascopy, day first)
    m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*((?:GMT|UTC)?\s*[+-]\d{2}:?\d{2}|Z|GMT|UTC)?$/i.exec(s);
    if (m) return fields(+m[3], +m[2], +m[1], m[4], m[5], m[6], null, m[7]);
    return null;
  }
  function fields(y, mo, d, H, M, S, ampm, zone) {
    H = +(H || 0); M = +(M || 0); S = +(S || 0);
    if (ampm) { var pm = /p/i.test(ampm); if (H === 12) H = pm ? 12 : 0; else if (pm) H += 12; }
    if (!okDate(y, mo, d) || H > 23 || M > 59 || S > 59) return null;
    if (zone) return Date.UTC(y, mo - 1, d, H, M, S) / 1000 - offsetSec(zone);
    return [y, mo, d, H, M, S];
  }
  // A separate time-of-day cell: 08:30 · 8:30:00 · 0830 · 083000 · 8:30 PM
  function parseClock(s) {
    s = String(s).trim();
    var m = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([AP]M)?$/i.exec(s);
    if (!m) {
      var d = /^\d{3,6}$/.test(s) ? (s.length <= 4 ? ('000' + s).slice(-4) + '00' : ('0' + s).slice(-6)) : null;
      if (!d) return null;
      m = [s, d.slice(0, 2), d.slice(2, 4), d.slice(4, 6), null];
    }
    var H = +m[1];
    if (m[4]) { var pm = /p/i.test(m[4]); if (H === 12) H = pm ? 12 : 0; else if (pm) H += 12; }
    return H > 23 || +m[2] > 59 ? null : [H, +m[2], +(m[3] || 0)];
  }
  function num(s, decimalComma) {
    s = String(s).trim();
    if (decimalComma && /^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 17,123.25
    var v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  }

  // CSV text → { S, step, skipped, symbols, rolled }. Recognises TradingView exports (unix or ISO time),
  // NinjaTrader (yyyyMMdd HHmmss;o;h;l;c;v, no header), Databento OHLCV (ts_event, nanosecond or
  // fixed-point fields, many contracts in one file), MetaTrader, Dukascopy and generic Date,Time,Open,…
  // files. Times without a zone are read in opts.tz (default CT).
  function parseCSV(text, opts) {
    opts = opts || {};
    var tz = opts.tz || CT;
    var lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/);
    var first = 0;
    while (first < lines.length && !lines[first].trim()) first++;
    if (first >= lines.length) throw new Error('The file is empty.');
    var head = lines[first];
    var delim = [',', ';', '\t', '|'].map(function (d) { return [d, head.split(d).length]; })
      .sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var cells = splitLine(head, delim).map(colName);
    var ix = {}, start = first;
    var hasHeader = findCol(cells, COLS.o) >= 0 && findCol(cells, COLS.c) >= 0;
    if (hasHeader) {
      start = first + 1;
      ['o', 'h', 'l', 'c', 'v', 'sym'].forEach(function (k) { ix[k] = findCol(cells, COLS[k]); });
      var dcol = findCol(cells, COLS.date), ccol = findCol(cells, COLS.clock);
      if (dcol >= 0 && ccol >= 0 && dcol !== ccol) { ix.date = dcol; ix.clock = ccol; }
      else ix.t = findCol(cells, COLS.t) >= 0 ? findCol(cells, COLS.t) : dcol;
      if (ix.t < 0 && ix.date == null) ix.t = 0;
      if (ix.h < 0 || ix.l < 0) throw new Error('Found open/close columns but no high/low — the file needs all four (OHLC).');
    } else {
      // No header: datetime,o,h,l,c[,v] — or date,time,o,h,l,c[,v] when the second cell is a time of day.
      var f = splitLine(head, delim);
      var split = f.length >= 6 && parseClock(f[1]) && /^\d{8}$|^\d{4}[-./]\d{1,2}[-./]\d{1,2}$|^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(f[0].trim());
      if (split) ix = { date: 0, clock: 1, o: 2, h: 3, l: 4, c: 5, v: f.length > 6 ? 6 : -1, sym: -1 };
      else if (f.length >= 5) ix = { t: 0, o: 1, h: 2, l: 3, c: 4, v: f.length > 5 ? 5 : -1, sym: -1 };
      else throw new Error('Couldn\'t find time, open, high, low and close columns in this file.');
    }
    var dc = delim === ';', rows = [], skipped = 0;
    for (var i = start; i < lines.length; i++) {
      var line = lines[i];
      if (!line || !line.trim()) continue;
      var r = splitLine(line, delim);
      var ts;
      if (ix.date != null) {
        var dd = parseStamp(r[ix.date]), cl = parseClock(r[ix.clock] || '');
        ts = Array.isArray(dd) && cl ? [dd[0], dd[1], dd[2], cl[0], cl[1], cl[2]] : null;
      } else ts = parseStamp(r[ix.t] == null ? '' : r[ix.t]);
      if (Array.isArray(ts)) ts = zonedToUtc(ts[0], ts[1], ts[2], ts[3], ts[4], ts[5], tz);
      var o = num(r[ix.o], dc), h = num(r[ix.h], dc), l = num(r[ix.l], dc), c = num(r[ix.c], dc);
      if (ts == null || !isFinite(ts) || !(o === o && h === h && l === l && c === c)) { skipped++; continue; }
      var v = ix.v >= 0 ? num(r[ix.v], dc) : 0;
      rows.push({ t: Math.floor(ts), o: o, h: h, l: l, c: c, v: v === v ? v : 0, s: ix.sym >= 0 ? String(r[ix.sym] || '').trim() : '' });
    }
    if (!rows.length) throw new Error('No price rows could be read from this file.');
    // Databento's raw fixed-point prices are integers scaled by 1e9.
    var closes = rows.map(function (x) { return x.c; }).sort(function (a, b) { return a - b; });
    if (closes[closes.length >> 1] > 1e8) rows.forEach(function (x) { x.o /= 1e9; x.h /= 1e9; x.l /= 1e9; x.c /= 1e9; });
    // Several contracts in one file (a Databento parent symbol): drop spreads, then keep each session's
    // most-traded outright — the front month — so a roll doesn't stitch two price levels together.
    var syms = {}, nsym = 0, rolled = false;
    rows.forEach(function (x) { if (x.s && !syms[x.s]) { syms[x.s] = 1; nsym++; } });
    if (nsym > 1) {
      var outright = rows.filter(function (x) { return !/[-:\s]/.test(x.s); });
      if (outright.length) rows = outright;
      var vol = {}, pick = {}, used = {};
      rows.forEach(function (x) {
        var k = sessionDay(x.t), m = vol[k] || (vol[k] = {});
        m[x.s] = (m[x.s] || 0) + (x.v || 0) + 1e-9;
      });
      Object.keys(vol).forEach(function (k) {
        var best = null;
        Object.keys(vol[k]).forEach(function (s) { if (best == null || vol[k][s] > vol[k][best]) best = s; });
        pick[k] = best; used[best] = 1;
      });
      rows = rows.filter(function (x) { return pick[sessionDay(x.t)] === x.s; });
      rolled = Object.keys(used).length > 1;
    }
    rows.sort(function (a, b) { return a.t - b.t; });
    var S = { t: [], o: [], h: [], l: [], c: [], v: [] };
    rows.forEach(function (x) {
      var n = S.t.length;
      if (n && S.t[n - 1] === x.t) { S.t.pop(); S.o.pop(); S.h.pop(); S.l.pop(); S.c.pop(); S.v.pop(); } // duplicate time: the later row wins
      S.t.push(x.t); S.o.push(x.o); S.c.push(x.c); S.v.push(x.v);
      S.h.push(Math.max(x.o, x.h, x.l, x.c)); S.l.push(Math.min(x.o, x.h, x.l, x.c));
    });
    return { S: S, step: detectStep(S), skipped: skipped, symbols: nsym, rolled: rolled };
  }

  // The bar size in seconds: the most common gap between consecutive bars.
  function detectStep(S) {
    var count = {}, best = 60, bestN = 0;
    for (var i = 1; i < S.t.length && i < 5000; i++) {
      var d = S.t[i] - S.t[i - 1];
      if (d > 0 && (count[d] = (count[d] || 0) + 1) > bestN) { bestN = count[d]; best = d; }
    }
    return best;
  }

  // Merge two sorted series; where both have a bar at the same time, b's wins (a re-import replaces).
  function merge(a, b) {
    var S = { t: [], o: [], h: [], l: [], c: [], v: [] }, i = 0, j = 0, na = a.t.length, nb = b.t.length;
    function put(X, k) { S.t.push(X.t[k]); S.o.push(X.o[k]); S.h.push(X.h[k]); S.l.push(X.l[k]); S.c.push(X.c[k]); S.v.push(X.v[k]); }
    while (i < na || j < nb) {
      if (j >= nb || (i < na && a.t[i] < b.t[j])) put(a, i++);
      else { if (i < na && a.t[i] === b.t[j]) i++; put(b, j++); }
    }
    return S;
  }

  function bar(S, i) { return { t: S.t[i], o: S.o[i], h: S.h[i], l: S.l[i], c: S.c[i], v: S.v[i] }; }

  // Trading sessions in a series: [{ day: 'YYYY-MM-DD', i0, i1 }] with i1 exclusive, in time order.
  function sessions(S) {
    var out = [], cur = null, dn = null;
    for (var i = 0; i < S.t.length; i++) {
      var k = Math.floor((ctWall(S.t[i]) + 7 * 3600) / 86400); // same day number sessionDay() names
      if (k !== dn) { dn = k; if (cur) cur.i1 = i; cur = { day: isoOfWall(k * 86400), i0: i, i1: i + 1 }; out.push(cur); }
    }
    if (cur) cur.i1 = S.t.length;
    return out;
  }

  // Fold one bar into a candle list at timeframe tf (seconds). Buckets start on multiples of tf in
  // UTC, which lines up with CT wall-clock boundaries for every tf that divides an hour.
  // Returns true when the bar opened a new candle.
  function pushBar(candles, b, tf) {
    var t = b.t - ((b.t % tf) + tf) % tf, last = candles[candles.length - 1];
    if (last && last.t === t) {
      if (b.h > last.h) last.h = b.h;
      if (b.l < last.l) last.l = b.l;
      last.c = b.c; last.v += b.v || 0;
      return false;
    }
    candles.push({ t: t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 });
    return true;
  }
  function aggregate(S, i0, i1, tf) {
    var out = [];
    for (var i = i0; i < i1; i++) pushBar(out, bar(S, i), tf);
    return out;
  }

  // ---- fills ----
  // Where a resting stop / target fills inside one bar, or null if neither is touched. A bar doesn't say
  // which extreme came first, so when both levels are inside its range the stop is assumed to fill
  // first — the conservative read. A bar that opens beyond a level fills at the open: a stop slips to
  // the gap, a target (a limit) gets the better price.
  function barExit(side, b, stop, target) {
    var hasS = stop != null && isFinite(stop), hasT = target != null && isFinite(target);
    if (side === 'long') {
      if (hasS && b.o <= stop) return { price: b.o, why: 'stop' };
      if (hasT && b.o >= target) return { price: b.o, why: 'target' };
      if (hasS && b.l <= stop) return { price: stop, why: 'stop' };
      if (hasT && b.h >= target) return { price: target, why: 'target' };
    } else {
      if (hasS && b.o >= stop) return { price: b.o, why: 'stop' };
      if (hasT && b.o <= target) return { price: b.o, why: 'target' };
      if (hasS && b.h >= stop) return { price: stop, why: 'stop' };
      if (hasT && b.l <= target) return { price: target, why: 'target' };
    }
    return null;
  }

  // Where a resting limit entry fills inside one bar, or null. A buy limit sits below the market: it fills
  // at the open when the bar opens at or below it, otherwise only when price trades through it by at
  // least a tick — a bare touch may not reach your place in the queue, so it isn't counted.
  function limitFill(side, b, price, tick) {
    var t = tick > 0 ? tick : 0;
    if (side === 'long') {
      if (b.o <= price) return b.o;
      return b.l <= price - t + 1e-9 ? price : null;
    }
    if (b.o >= price) return b.o;
    return b.h >= price + t - 1e-9 ? price : null;
  }

  // Price at which an open trade takes the session's net to the daily stop. room = dollars this trade
  // can lose before that (stop + realized so far − this trade's fees). Rounded to the first tick at or
  // beyond it — where a platform's loss-limit liquidation would actually trigger.
  function lossLimitPrice(side, entry, qty, pp, room, tick) {
    var px = entry - (side === 'long' ? 1 : -1) * room / (pp * qty);
    if (!(tick > 0)) return px;
    var n = px / tick;
    return Math.round((side === 'long' ? Math.floor(n + 1e-9) : Math.ceil(n - 1e-9)) * tick * 1e6) / 1e6;
  }

  // Net dollars on a closed trade: points × $/point × contracts, minus round-turn fees per contract.
  function tradeNet(side, entry, exit, qty, pp, fee) {
    var pts = side === 'long' ? exit - entry : entry - exit;
    return Math.round((pts * pp * qty - (fee || 0) * qty) * 100) / 100;
  }

  // Totals for a list of closed trades ({ net }).
  function summarize(trades) {
    var s = { n: trades.length, wins: 0, losses: 0, net: 0, won: 0, lost: 0, best: 0, worst: 0 };
    trades.forEach(function (x) {
      s.net += x.net;
      if (x.net > 0) { s.wins++; s.won += x.net; } else if (x.net < 0) { s.losses++; s.lost -= x.net; }
      if (x.net > s.best) s.best = x.net;
      if (x.net < s.worst) s.worst = x.net;
    });
    s.net = Math.round(s.net * 100) / 100;
    s.winRate = s.n ? s.wins / s.n : 0;
    s.pf = s.lost > 0 ? s.won / s.lost : (s.won > 0 ? Infinity : 0);
    return s;
  }

  // ---- data providers (the app calls them straight from the browser with the user's own key) ----
  // Databento historical query for 1-minute CME bars. A bare root (NQ) means the continuous front month
  // (NQ.c.0); NQ.c.1 / NQ.v.0 stay continuous, NQ.FUT is the parent (every contract — parseCSV keeps the
  // front month), anything else is a raw contract symbol (NQH4). Dates are YYYY-MM-DD in CT; the window
  // opens at 17:00 CT the evening before `from`, so the first session is whole.
  function databentoQuery(symbol, from, to) {
    var sym = String(symbol || '').trim().toUpperCase(), stype;
    if (/^[A-Z0-9]{1,4}$/.test(sym) && !/[FGHJKMNQUVXZ]\d{1,2}$/.test(sym)) { sym += '.c.0'; stype = 'continuous'; }
    else if (/^[A-Z0-9]{1,4}\.[CVN]\.\d+$/.test(sym)) { sym = sym.replace(/\.([CVN])\./, function (m, c) { return '.' + c.toLowerCase() + '.'; }); stype = 'continuous'; }
    else if (/\.FUT$/.test(sym)) stype = 'parent';
    else stype = 'raw_symbol';
    var f = from.split('-'), t = to.split('-');
    var start = zonedToUtc(+f[0], +f[1], +f[2] - 1, 17, 0, 0, CT), end = zonedToUtc(+t[0], +t[1], +t[2], 16, 0, 0, CT);
    var iso = function (x) { return new Date(x * 1000).toISOString().replace('.000', ''); };
    return { dataset: 'GLBX.MDP3', schema: 'ohlcv-1m', symbols: sym, stype_in: stype, start: iso(start), end: iso(end) };
  }
  // Massive (formerly Polygon) aggregates JSON → a series. Bar times there are unix milliseconds.
  function massiveToSeries(results) {
    var S = { t: [], o: [], h: [], l: [], c: [], v: [] };
    (results || []).slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (r) {
      var t = Math.floor(r.t / 1000), n = S.t.length;
      if (!isFinite(t) || !(r.o === r.o && r.c === r.c)) return;
      if (n && S.t[n - 1] === t) return;
      S.t.push(t); S.o.push(r.o); S.c.push(r.c); S.v.push(r.v || 0);
      S.h.push(Math.max(r.o, r.h, r.l, r.c)); S.l.push(Math.min(r.o, r.h, r.l, r.c));
    });
    return S;
  }
  // The product root of a futures symbol: NQ.c.0 → NQ, MNQH4 / MNQH24 → MNQ, ES.FUT → ES.
  function symbolRoot(sym) {
    return String(sym || '').trim().toUpperCase().replace(/\.(C|V|N)\.\d+$|\.FUT$/, '').replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '');
  }

  var api = { CT: CT, databentoQuery: databentoQuery, massiveToSeries: massiveToSeries, symbolRoot: symbolRoot, tzOffset: tzOffset, zonedToUtc: zonedToUtc, ctWall: ctWall, sessionDay: sessionDay,
    parseStamp: parseStamp, parseClock: parseClock, parseCSV: parseCSV, detectStep: detectStep, merge: merge,
    bar: bar, sessions: sessions, pushBar: pushBar, aggregate: aggregate, barExit: barExit, limitFill: limitFill,
    lossLimitPrice: lossLimitPrice, tradeNet: tradeNet, summarize: summarize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CTReplay = api;
})(this);
