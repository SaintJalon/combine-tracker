// Build the server from a computer instead of the worker's /setup page — same steps, same result:
//   DISCORD_TOKEN=… DISCORD_APP_ID=… GUILD_ID=… node discord/setup.mjs
// Handy if Discord rate-limits the worker, or to rebuild without opening the page. Needs Node 18+.
import worker from './worker.mjs';
const { runSetup } = worker.lib;

const env = { DISCORD_TOKEN: process.env.DISCORD_TOKEN, DISCORD_APP_ID: process.env.DISCORD_APP_ID, GUILD_ID: process.env.GUILD_ID, TRACKER_URL: process.env.TRACKER_URL };
for (let round = 0; ; round++) {
  const r = await runSetup(env, { round, budget: Infinity });
  r.log.forEach((l) => console.log(l));
  if (r.error) { console.error('✗ ' + r.error); process.exit(1); }
  if (r.done) { console.log('✓ Done. Invite: ' + r.invite); break; }
  if (r.wait) { console.log(`… Discord asked to slow down — waiting ${Math.ceil(r.wait / 1000)}s`); await new Promise((ok) => setTimeout(ok, r.wait)); }
}
