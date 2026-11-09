// Run: node tests/news.test.js — checks news.js (Forex Factory calendar + FinancialJuice headlines).
const assert = require('assert');
const N = require('../news.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

// shaped like nfs.faireconomy.media/ff_calendar_thisweek.json (times in US Eastern)
const FF = [
  { title: 'CPI m/m', country: 'USD', date: '2026-11-10T08:30:00-05:00', impact: 'High', forecast: '0.3%', previous: '0.6%' },
  { title: 'Core CPI m/m', country: 'USD', date: '2026-11-10T08:30:00-05:00', impact: 'High', forecast: '0.2%', previous: '0.3%' },
  { title: 'GDP m/m', country: 'GBP', date: '2026-11-12T02:00:00-05:00', impact: 'High', forecast: '0.0%', previous: '0.1%' },
  { title: 'Bank Holiday', country: 'USD', date: '2026-11-11T00:00:00-05:00', impact: 'Holiday', forecast: '', previous: '' },
  { title: 'Crude Oil Inventories', country: 'USD', date: '2026-11-12T10:30:00-05:00', impact: 'Medium', forecast: '', previous: '-1.2M' },
  { title: 'broken', country: 'USD', date: 'not a date', impact: 'High' }
];
const ev = N.parseFF(FF);

t('parses, drops bad rows, sorts by time', () => {
  assert.strictEqual(ev.length, 5);
  assert.deepStrictEqual(ev.map((e) => e.title), ['Core CPI m/m', 'CPI m/m', 'Bank Holiday', 'GDP m/m', 'Crude Oil Inventories']);
});
t('8:30 ET shows as 7:30am CT on Tue 11/10', () => {
  const cpi = ev.find((e) => e.title === 'CPI m/m');
  assert.strictEqual(N.ctTime(cpi.t), '7:30am');
  assert.strictEqual(N.ctDate(cpi.t), '2026-11-10');
});
t('a 2:00am ET release is 1:00am CT the same day', () => {
  const gdp = ev.find((e) => e.cur === 'GBP');
  assert.strictEqual(N.ctTime(gdp.t), '1:00am');
  assert.strictEqual(N.ctDate(gdp.t), '2026-11-12');
});
t('holidays are all-day, stay on their own date, and never trip the guard', () => {
  const hol = ev.find((e) => e.impact === 'Holiday');
  assert.strictEqual(hol.allDay, true);
  assert.strictEqual(N.eventDay(hol), '2026-11-11'); // midnight ET would be 11pm CT on the 10th
  assert.strictEqual(N.eventDay(ev.find((e) => e.title === 'CPI m/m')), '2026-11-10');
  assert.deepStrictEqual(N.guardHits(ev, hol.t, 5, 5, ['High', 'Holiday']), []);
});
const cpiT = Date.parse('2026-11-10T08:30:00-05:00');
t('guard window: 5 min before to 5 min after a red-folder release', () => {
  const at = (m) => N.guardHits(ev, cpiT + m * 60000, 5, 5, ['High']).length;
  assert.strictEqual(at(-6), 0);
  assert.strictEqual(at(-5), 2); // CPI and Core CPI together
  assert.strictEqual(at(0), 2);
  assert.strictEqual(at(5), 2);
  assert.strictEqual(at(6), 0);
});
t('medium events only count when Medium is included', () => {
  const oil = Date.parse('2026-11-12T10:30:00-05:00');
  assert.strictEqual(N.guardHits(ev, oil, 5, 5, ['High']).length, 0);
  assert.strictEqual(N.guardHits(ev, oil, 5, 5, ['High', 'Medium']).length, 1);
});
t('next event skips past and all-day items', () => {
  assert.strictEqual(N.nextEvent(ev, cpiT - 3600000, ['High']).title, 'Core CPI m/m');
  assert.strictEqual(N.nextEvent(ev, cpiT + 60000, ['High']).cur, 'GBP');
  assert.strictEqual(N.nextEvent(ev, Date.parse('2026-11-13T00:00:00Z'), ['High']), null);
});
t('countdown text', () => {
  assert.strictEqual(N.untilTxt(cpiT, cpiT - 72 * 60000), 'in 1h 12m');
  assert.strictEqual(N.untilTxt(cpiT, cpiT - 4 * 60000), 'in 4m');
  assert.strictEqual(N.untilTxt(cpiT, cpiT), 'now');
  assert.strictEqual(N.untilTxt(cpiT, cpiT + 6 * 60000), '6m ago');
  assert.strictEqual(N.untilTxt(cpiT, cpiT - 120 * 60000), 'in 2h');
});
t('not an array → no events', () => {
  assert.deepStrictEqual(N.parseFF({ error: 'x' }), []);
});

// shaped like financialjuice.com/feed.ashx?xy=rss
const RSS = '<rss version="2.0"><channel><title>FinancialJuice</title>' +
  '<item><title>FinancialJuice: US CPI M/M Actual 0.4% (Forecast 0.3%, Previous 0.6%)</title><link>https://www.financialjuice.com/News/1/US-CPI.aspx?xy=rss</link><description /><pubDate>Tue, 10 Nov 2026 13:30:05 GMT</pubDate><guid isPermaLink="false">1</guid></item>' +
  '<item><title>FinancialJuice: Fed&#39;s Powell: rates &amp; &quot;patience&quot;</title><link>https://www.financialjuice.com/News/2/Powell.aspx?xy=rss</link><pubDate>Tue, 10 Nov 2026 15:00:00 GMT</pubDate><guid isPermaLink="false">2</guid></item>' +
  '<item><title><![CDATA[FinancialJuice: Oil <b>jumps</b>]]></title><link>javascript:alert(1)</link><pubDate>Tue, 10 Nov 2026 14:00:00 GMT</pubDate><guid>3</guid></item>' +
  '<item><title></title><link>https://x.example</link></item></channel></rss>';
t('headlines: prefix dropped, entities decoded, newest first, empty dropped', () => {
  const h = N.parseRSS(RSS);
  assert.deepStrictEqual(h.map((x) => x.title), ["Fed's Powell: rates & \"patience\"", 'Oil <b>jumps</b>', 'US CPI M/M Actual 0.4% (Forecast 0.3%, Previous 0.6%)']);
  assert.strictEqual(h[2].id, '1');
  assert.strictEqual(h[2].t, Date.parse('2026-11-10T13:30:05Z'));
});
t('only http(s) links are kept (the page escapes titles itself)', () => {
  const h = N.parseRSS(RSS);
  assert.strictEqual(h.find((x) => x.id === '3').link, '');
  assert.ok(h.find((x) => x.id === '2').link.startsWith('https://www.financialjuice.com/'));
});
t('garbage → no headlines', () => {
  assert.deepStrictEqual(N.parseRSS('<html>Error code: 1015</html>'), []);
  assert.deepStrictEqual(N.parseRSS(null), []);
});
console.log('\n' + n + ' passed');
