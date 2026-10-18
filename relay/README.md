# Market-data relay (Cloudflare Worker)

Replay's **Download bars** calls Databento or Massive straight from your browser. A browser only lets
a page read another site's answer if that site allows it, and data providers don't always. This relay
fixes that: the app asks the relay, the relay asks the provider, and hands the answer back with the
headers the browser needs. It runs free on Cloudflare (the free plan allows 100,000 requests a day;
a download uses one to a few).

It is deliberately narrow: it forwards only the market-data calls Replay makes, only for your site,
and stores nothing. Your API key is still typed into the app and passes through with each request —
the relay holds no key, so nobody who finds its address can spend your data credit.

## Set it up (about 5 minutes, no terminal)
1. Sign up or log in at **dash.cloudflare.com** (free).
2. **Workers & Pages → Create → Create Worker** (start from "Hello World"). Name it e.g. `ct-relay` → **Deploy**.
3. **Edit code**: delete everything in the editor, paste the whole of [`worker.mjs`](worker.mjs) → **Deploy**.
4. Copy the worker's address — it looks like `https://ct-relay.YOURNAME.workers.dev`.
   Open it in a browser: you should see `{"relay":"combine-tracker","ok":true}`.
5. In the app: **Replay → Market Data → Download bars → Relay**, paste the address, tap **Check**.
   It should say the relay is working. Downloads now go through it.

If your app isn't at `https://saintjalon.github.io`, add a variable in the worker's
**Settings → Variables**: `ALLOWED_ORIGINS` = your site's address (comma-separate several).

## From a terminal instead
```bash
cd relay
npx wrangler deploy        # logs you in to Cloudflare the first time
```

## Test it
`node tests/relay.test.mjs` (from the repo root) checks what it forwards and what it refuses.
