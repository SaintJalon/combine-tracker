// News for the tracker: Forex Factory's economic calendar and FinancialJuice's headlines.
// Pure functions — no DOM, no fetching — shared by index.html and tests/news.test.js.
(function (root) {
  var CT = 'America/Chicago';

  // Forex Factory's week JSON ({title,country,date,impact,forecast,previous}) → events sorted by time:
  // {t (ms), title, cur, impact: High|Medium|Low|Holiday, forecast, previous, allDay}.
  function parseFF(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (x) {
      var t = Date.parse(x && x.date);
      if (!x || isNaN(t)) return null;
      var impact = String(x.impact || '');
      return {
        t: t, title: String(x.title || ''), cur: String(x.country || ''), impact: impact,
        forecast: String(x.forecast || ''), previous: String(x.previous || ''),
        // holidays and "tentative" items come at midnight with no real time
        allDay: impact === 'Holiday' || /T00:00:00/.test(String(x.date)),
        day: String(x.date).slice(0, 10) // the calendar's own date: midnight ET is 11pm CT the day before
      };
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t || a.title.localeCompare(b.title); });
  }

  // The Central-time calendar date (YYYY-MM-DD) and clock time (e.g. 7:30am) of a timestamp.
  function ctDate(t) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: CT, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function ctTime(t) {
    return new Intl.DateTimeFormat('en-US', { timeZone: CT, hour: 'numeric', minute: '2-digit' })
      .format(new Date(t)).replace(' AM', 'am').replace(' PM', 'pm');
  }

  // The day an event belongs to: an all-day item (holiday, tentative) keeps the calendar's own date;
  // a timed release is on the Central-time date it happens.
  function eventDay(e) { return e.allDay && /^\d{4}-\d{2}-\d{2}$/.test(e.day || '') ? e.day : ctDate(e.t); }

  // Minutes after midnight, Central time (7:30am → 450).
  function ctMinutes(t) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: CT, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return (+p.hour % 24) * 60 + (+p.minute);
  }
  // Timed red-folder (or `impacts`) releases on a CT date inside the trading day (default 5:00am–4:00pm CT),
  // grouped by release time: [{t, events:[...]}] — CPI and Core CPI at 7:30 are one group.
  function sessionGroups(evs, dayIso, impacts, fromMin, toMin) {
    var from = fromMin == null ? 300 : fromMin, to = toMin == null ? 960 : toMin, out = [];
    (evs || []).forEach(function (e) {
      if (e.allDay || impacts.indexOf(e.impact) < 0 || ctDate(e.t) !== dayIso) return;
      var m = ctMinutes(e.t); if (m < from || m > to) return;
      var g = out.length && out[out.length - 1].t === e.t ? out[out.length - 1] : null;
      if (g) g.events.push(e); else out.push({ t: e.t, events: [e] });
    });
    return out;
  }

  // Events whose guard window (from `before` minutes ahead of the release to `after` minutes past it)
  // contains `now`. Only timed events with an impact in `impacts` count.
  function guardHits(evs, now, before, after, impacts) {
    return (evs || []).filter(function (e) {
      return !e.allDay && impacts.indexOf(e.impact) >= 0 && now >= e.t - before * 60000 && now <= e.t + after * 60000;
    });
  }
  // The next timed event (at or after `now`) with an impact in `impacts`, or null.
  function nextEvent(evs, now, impacts) {
    for (var i = 0; i < (evs || []).length; i++) { var e = evs[i]; if (!e.allDay && e.t >= now && impacts.indexOf(e.impact) >= 0) return e; }
    return null;
  }
  // "in 1h 12m" / "in 4m" / "now" / "6m ago"
  function untilTxt(t, now) {
    var m = Math.round((t - now) / 60000), a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60;
    var s = h ? h + 'h' + (mm ? ' ' + mm + 'm' : '') : mm + 'm';
    return m === 0 ? 'now' : (m > 0 ? 'in ' + s : s + ' ago');
  }

  function decode(s) {
    return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  }
  // An RSS feed (FinancialJuice's) → [{id, title, link, t}], newest first. Drops the "FinancialJuice: " prefix;
  // links must be http(s).
  function parseRSS(xml) {
    var items = String(xml || '').match(/<item[\s>][\s\S]*?<\/item>/g) || [];
    function field(it, tag) { var m = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(it); return m ? decode(m[1]) : ''; }
    return items.map(function (it) {
      var title = field(it, 'title').replace(/^FinancialJuice:\s*/i, ''), link = field(it, 'link'), t = Date.parse(field(it, 'pubDate'));
      if (!/^https?:\/\//i.test(link)) link = '';
      return title ? { id: field(it, 'guid') || link || title, title: title, link: link, t: isNaN(t) ? 0 : t } : null;
    }).filter(Boolean).sort(function (a, b) { return b.t - a.t; });
  }

  var api = { parseFF: parseFF, ctDate: ctDate, eventDay: eventDay, ctMinutes: ctMinutes, sessionGroups: sessionGroups, ctTime: ctTime, guardHits: guardHits, nextEvent: nextEvent, untilTxt: untilTxt, parseRSS: parseRSS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CTNews = api;
})(this);
