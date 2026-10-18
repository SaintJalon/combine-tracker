// Market-data relay for Replay's downloads — a Cloudflare Worker (free plan is plenty).
//
// Browsers only let a web page read another site's response when that site says so (CORS). Data
// providers don't always say so, so the app can send its downloads here instead: the relay calls
// the provider and hands the answer back with the headers the browser needs.
//
// It is deliberately narrow:
//   - it forwards only the exact market-data calls Replay makes, to Databento and Massive — it is not
//     an open proxy;
//   - it answers only the origins in ALLOWED_ORIGINS (default: the tracker's GitHub Pages site);
//   - it stores nothing and holds no key of its own — your key comes with each request from the app,
//     so nobody who finds the relay's address can spend your data credit.
//
// Deploy: see relay/README.md. Optional variable ALLOWED_ORIGINS — comma-separated, e.g.
// "https://saintjalon.github.io,http://localhost:8765".

const UPSTREAM = { databento: 'https://hist.databento.com', massive: 'https://api.massive.com' };
const PATHS = {
  databento: /^\/v0\/(timeseries\.get_range|metadata\.get_cost)$/,
  massive: /^\/v2\/aggs\/ticker\/[A-Za-z0-9.:_-]{1,20}\/range\/1\/minute\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/
};
const DEFAULT_ORIGINS = 'https://saintjalon.github.io';

function reply(status, body, headers) {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers: h });
}

export default {
  async fetch(req, env = {}) {
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const okOrigin = allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin && origin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (req.method !== 'GET') return reply(405, { error: 'Only GET.' }, cors);

    const url = new URL(req.url);
    // health check, so the app can confirm the relay is up
    if (url.pathname === '/' || url.pathname === '') return reply(200, { relay: 'combine-tracker', ok: true }, cors);
    if (!okOrigin) return reply(403, { error: 'This relay only serves ' + allowed.join(', ') + '. Add your site to ALLOWED_ORIGINS.' }, cors);

    const m = /^\/(databento|massive)(\/.*)$/.exec(url.pathname);
    if (!m || !PATHS[m[1]].test(m[2])) return reply(404, { error: 'Not a market-data request this relay forwards.' }, cors);
    const src = m[1];
    // *_BASE exist only so the relay can be tested against a stand-in provider
    const base = (src === 'databento' ? env.DATABENTO_BASE : env.MASSIVE_BASE) || UPSTREAM[src];
    const headers = {};
    const auth = req.headers.get('Authorization');
    if (src === 'databento' && auth) headers.Authorization = auth;

    let up;
    try { up = await fetch(base + m[2] + url.search, { headers }); }
    catch (e) { return reply(502, { error: 'The relay could not reach ' + src + '.' }, cors); }
    const out = new Headers(cors);
    for (const h of ['Content-Type', 'Retry-After']) { const v = up.headers.get(h); if (v) out.set(h, v); }
    out.set('Cache-Control', 'no-store');
    return new Response(up.body, { status: up.status, headers: out });
  }
};
