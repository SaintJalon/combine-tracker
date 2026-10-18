// Run: node tests/relay.test.mjs — checks relay/worker.mjs: what it forwards, what it refuses, and its CORS headers.
import assert from 'node:assert';
import worker from '../relay/worker.mjs';

let n = 0, calls = [];
async function t(name, fn) { calls = []; await fn(); n++; console.log('ok  ' + name); }
// stand-in for the providers: records the call, answers with what it was asked
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), auth: (opts && opts.headers && opts.headers.Authorization) || null });
  return new Response('ts_event,open\n1,2', { status: 200, headers: { 'Content-Type': 'text/csv', 'Set-Cookie': 'x=1' } });
};
const SITE = 'https://saintjalon.github.io';
const R = (path, o = {}) => worker.fetch(new Request('https://ct-relay.example.workers.dev' + path, { method: o.method || 'GET', headers: Object.assign({ Origin: o.origin === undefined ? SITE : o.origin }, o.headers || {}) }), o.env || {});
const DB = '/databento/v0/timeseries.get_range?dataset=GLBX.MDP3&schema=ohlcv-1m&symbols=NQ.c.0';

await t('health check answers anyone, so the app can confirm the address', async () => {
  const r = await R('/', { origin: '' });
  assert.deepStrictEqual(await r.json(), { relay: 'combine-tracker', ok: true });
});
await t('Databento: forwards path, query and the caller\'s key; CORS for the site', async () => {
  const r = await R(DB, { headers: { Authorization: 'Basic abc' } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(calls, [{ url: 'https://hist.databento.com/v0/timeseries.get_range?dataset=GLBX.MDP3&schema=ohlcv-1m&symbols=NQ.c.0', auth: 'Basic abc' }]);
  assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.strictEqual(r.headers.get('Content-Type'), 'text/csv');
  assert.strictEqual(r.headers.get('Set-Cookie'), null); // only safe headers are passed back
  assert.strictEqual(await r.text(), 'ts_event,open\n1,2');
});
await t('Massive: forwards the minute-aggregates call with its apiKey, and no Authorization', async () => {
  await R('/massive/v2/aggs/ticker/QQQ/range/1/minute/2024-01-02/2024-01-31?adjusted=true&apiKey=k', { headers: { Authorization: 'Basic abc' } });
  assert.deepStrictEqual(calls, [{ url: 'https://api.massive.com/v2/aggs/ticker/QQQ/range/1/minute/2024-01-02/2024-01-31?adjusted=true&apiKey=k', auth: null }]);
});
await t('preflight: allowed for the site, with Authorization allowed', async () => {
  const r = await R(DB, { method: 'OPTIONS' });
  assert.strictEqual(r.status, 204);
  assert.strictEqual(r.headers.get('Access-Control-Allow-Headers'), 'Authorization');
});
await t('other sites are refused and nothing is forwarded', async () => {
  const r = await R(DB, { origin: 'https://evil.example' });
  assert.strictEqual(r.status, 403);
  assert.strictEqual((await R(DB, { origin: 'https://evil.example', method: 'OPTIONS' })).status, 403);
  assert.strictEqual(calls.length, 0);
});
await t('ALLOWED_ORIGINS adds sites', async () => {
  const r = await R(DB, { origin: 'http://localhost:8765', env: { ALLOWED_ORIGINS: 'https://a.example, http://localhost:8765/' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8765');
});
await t('not an open proxy: other paths, providers and methods are refused', async () => {
  for (const p of ['/databento/v0/batch.submit_job', '/databento/v0/timeseries.get_range/../../x', '/massive/v3/reference/tickers', '/massive/v2/aggs/ticker/QQQ/range/1/day/2024-01-02/2024-01-31', '/other/v0/x', '/https://example.com']) {
    assert.strictEqual((await R(p)).status, 404, p);
  }
  assert.strictEqual((await R(DB, { method: 'POST' })).status, 405);
  assert.strictEqual(calls.length, 0);
});
await t('provider unreachable → 502 the app can explain', async () => {
  const keep = globalThis.fetch; globalThis.fetch = async () => { throw new Error('down'); };
  const r = await R(DB);
  globalThis.fetch = keep;
  assert.strictEqual(r.status, 502);
});

console.log('\n' + n + ' passed');
