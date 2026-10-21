// Run: node tests/discord.test.mjs — checks discord/worker.mjs: Discord's limits on every post and command,
// signed interactions, the slash commands, the Eastern-time calendar, and setup against a stand-in server.
import assert from 'node:assert';
import worker from '../discord/worker.mjs';
const B = worker.lib;

let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok  ' + name); }

// ── a stand-in Discord: one server, its roles, channels and messages ──
const APP = '900000000000000001', GUILD = '800000000000000001', BOT = APP;
function fakeDiscord(opts = {}) {
  let id = 1000;
  const next = () => String(810000000000000000n + BigInt(id++));
  const s = {
    roles: [{ id: GUILD, name: '@everyone' }],
    channels: [{ id: '700', name: 'Text Channels', type: 4 }, { id: '701', name: 'general', type: 0, parent_id: '700' }, { id: '702', name: 'Voice Channels', type: 4 }, { id: '703', name: 'General', type: 2, parent_id: '702' }],
    messages: {}, commands: [], memberRoles: [], calls: [], writes: [], perRun: 0, failOn: opts.failOn || null
  };
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url), path = u.pathname.replace('/api/v10', ''), method = o.method || 'GET', body = o.body ? JSON.parse(o.body) : undefined;
    assert.strictEqual(o.headers.Authorization, 'Bot tok');
    s.calls.push(method + ' ' + path); s.perRun++;
    if (method !== 'GET') s.writes.push(method + ' ' + path);
    const ok = (x, status = 200) => new Response(x === null ? null : JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
    if (s.failOn && s.failOn(method, path, s)) { s.failOn = null; return ok({ message: 'You are being rate limited.', retry_after: 1.5 }, 429); }
    let m;
    if (path === `/applications/${APP}/guilds/${GUILD}/commands`) {
      if (method === 'PUT') s.commands = body.map((c) => Object.assign({ id: next() }, c));
      return ok(s.commands);
    }
    if (path === '/users/@me') return ok({ id: BOT, username: 'bot' });
    if (path === `/guilds/${GUILD}/roles`) {
      if (method === 'POST') { const r = Object.assign({ id: next() }, body); s.roles.push(r); return ok(r); }
      return ok(s.roles);
    }
    if (path === `/guilds/${GUILD}/channels`) {
      if (method === 'POST') { const c = Object.assign({ id: next() }, body); s.channels.push(c); s.messages[c.id] = []; return ok(c); }
      return ok(s.channels);
    }
    if ((m = /^\/channels\/(\d+)$/.exec(path)) && method === 'PATCH') { const c = s.channels.find((x) => x.id === m[1]); Object.assign(c, body); return ok(c); }
    if ((m = /^\/channels\/(\d+)\/messages$/.exec(path))) {
      const list = s.messages[m[1]] || (s.messages[m[1]] = []);
      if (method === 'POST') { const msg = Object.assign({ id: next(), author: { id: BOT } }, body); list.unshift(msg); return ok(msg); }
      return ok(list.slice(0, +u.searchParams.get('limit') || 50));
    }
    if ((m = /^\/channels\/(\d+)\/invites$/.exec(path))) return ok({ code: 'abc123' });
    if ((m = new RegExp(`^/guilds/${GUILD}/members/(\\d+)/roles/(\\d+)$`).exec(path))) {
      if (method === 'PUT') s.memberRoles.push(m[2]); else s.memberRoles = s.memberRoles.filter((r) => r !== m[2]);
      return ok(null, 204);
    }
    return ok({ message: 'Unknown route ' + method + ' ' + path }, 404);
  };
  return s;
}
const ENV = { DISCORD_TOKEN: 'tok', DISCORD_APP_ID: APP, GUILD_ID: GUILD, SETUP_KEY: 'open-sesame' };
async function setupAll(env = ENV, s) {
  const rounds = [];
  for (let round = 0; round < 50; round++) {
    s.perRun = 0;
    const r = await B.runSetup(env, { round });
    rounds.push(s.perRun);
    assert.ok(!r.error, r.error);
    if (r.done) return { r, rounds };
  }
  throw new Error('setup never finished');
}
const allChannels = B.CATEGORIES.flatMap((c) => c.channels);

// ── Discord's limits ──
const FULL_IDS = { channels: Object.fromEntries(allChannels.map((c) => [c.name, '1234567890123456789'])), commands: Object.fromEntries(B.COMMANDS.map((c) => [c.name, '1234567890123456789'])), roles: Object.fromEntries(B.ROLES.map((r) => [r.key, '1234567890123456789'])) };

await t('every post fits in one message (2,000 characters), with real ids filled in', async () => {
  for (const ch of allChannels) for (const m of B.channelMessages(ch, FULL_IDS)) assert.ok(m.content.length <= 2000, `#${ch.name} is ${m.content.length} long`);
  for (const ms of [Date.UTC(2026, 9, 19, 12), Date.UTC(2026, 9, 19, 13, 30), Date.UTC(2026, 9, 19, 16), Date.UTC(2026, 9, 19, 19), Date.UTC(2026, 9, 25, 22)]) {
    for (const p of B.duePosts(ms)) assert.ok(B.render(p.content, FULL_IDS).length <= 2000);
  }
});
await t('every {#channel} and {/command} in a post points at something that exists', async () => {
  const texts = allChannels.flatMap((c) => c.posts || []).concat(B.duePosts(Date.UTC(2026, 9, 19, 12)).map((p) => p.content), B.duePosts(Date.UTC(2026, 9, 25, 22)).map((p) => p.content));
  const names = new Set(allChannels.map((c) => c.name)), cmds = new Set(B.COMMANDS.map((c) => c.name));
  for (const s of texts) {
    for (const [, x] of s.matchAll(/\{#([^}]+)\}/g)) assert.ok(names.has(x), 'no channel #' + x);
    for (const [, x] of s.matchAll(/\{\/([^}]+)\}/g)) assert.ok(cmds.has(x), 'no command /' + x);
    assert.ok(!/[{}]/.test(s.replace(/\{[#/@][a-z0-9-]+\}|\{tracker\}/g, '')), 'stray placeholder in: ' + s.slice(0, 60));
  }
});
await t('channels: valid names, topics under 1,024, no duplicates', async () => {
  const seen = new Set();
  for (const ch of allChannels) {
    if (!ch.voice) assert.match(ch.name, /^[a-z0-9-]{1,100}$/, ch.name);
    assert.ok(!ch.topic || ch.topic.length <= 1024);
    assert.ok(!seen.has(ch.name), 'duplicate ' + ch.name); seen.add(ch.name);
  }
  for (const c of B.CATEGORIES) assert.ok(c.channels.length <= 50);
});
await t('commands: names, descriptions and options within Discord\'s rules', async () => {
  assert.ok(B.COMMANDS.length <= 100);
  for (const c of B.COMMANDS) {
    assert.match(c.name, /^[a-z0-9_-]{1,32}$/);
    assert.ok(c.description.length >= 1 && c.description.length <= 100, c.name + ': ' + c.description.length);
    let optionalSeen = false;
    for (const o of c.options || []) {
      assert.match(o.name, /^[a-z0-9_-]{1,32}$/);
      assert.ok(o.description.length <= 100, c.name + '.' + o.name);
      if (!o.required) optionalSeen = true; else assert.ok(!optionalSeen, c.name + ': required options must come first');
      for (const ch of o.choices || []) assert.ok(ch.name.length <= 100);
      assert.ok(!o.choices || o.choices.length <= 25);
    }
  }
});
await t('the bot asks only for the permissions it uses', async () => {
  // create invite, manage channels, view, send, embed links, read history, manage roles — no Administrator
  assert.strictEqual(B.BOT_PERMISSIONS, String(1 + 16 + 1024 + 2048 + 16384 + 65536 + 268435456));
});

// ── signed interactions ──
const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const hex = (buf) => Buffer.from(buf).toString('hex');
const PUB = hex(await crypto.subtle.exportKey('raw', keys.publicKey));
async function signed(body, o = {}) {
  const raw = JSON.stringify(body), stamp = '1700000000';
  const sig = hex(await crypto.subtle.sign({ name: 'Ed25519' }, keys.privateKey, new TextEncoder().encode(stamp + raw)));
  const headers = { 'X-Signature-Ed25519': o.badSig ? sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')) : sig, 'X-Signature-Timestamp': stamp };
  if (o.unsigned) delete headers['X-Signature-Ed25519'];
  return worker.fetch(new Request('https://bot.example.workers.dev/interactions', { method: 'POST', headers, body: raw }), Object.assign({}, ENV, { DISCORD_PUBLIC_KEY: PUB }));
}
const USER = { id: '600000000000000001', username: 'jay', global_name: 'Jay' };
const cmd = (name, options = [], extra = {}) => Object.assign({ type: 2, guild_id: GUILD, member: { user: USER, roles: [] }, data: { name, options: options.map(([k, v]) => ({ name: k, value: v })) } }, extra);

await t('Discord\'s ping is answered; unsigned and mis-signed requests get 401', async () => {
  assert.deepStrictEqual(await (await signed({ type: 1 })).json(), { type: 1 });
  assert.strictEqual((await signed({ type: 1 }, { unsigned: true })).status, 401);
  assert.strictEqual((await signed({ type: 1 }, { badSig: true })).status, 401);
});
await t('health check says what is configured, never the values', async () => {
  const r = await (await worker.fetch(new Request('https://bot.example.workers.dev/'), ENV)).json();
  assert.deepStrictEqual(r.configured, { DISCORD_APP_ID: true, DISCORD_PUBLIC_KEY: false, DISCORD_TOKEN: true, GUILD_ID: true, SETUP_KEY: true });
  assert.ok(!JSON.stringify(r).includes('tok'));
});

// ── commands ──
await t('/risk: $50K on NQ at the 20-point stop → 1 NQ is too big, 6 MNQ fits; 1:4 = 80, breakeven 40', async () => {
  const p = B.riskPlan({ account: 50000 });
  assert.strictEqual(p.risk, 250); assert.strictEqual(p.per, 400);
  assert.strictEqual(p.size, 6); assert.strictEqual(p.sym, 'MNQ');
  assert.match(p.text, /\$500\*\* for the day/); assert.match(p.text, /\*\*80 pts\*\*/); assert.match(p.text, /\*\*40 pts\*\*/);
});
await t('/risk: $150K on ES with a 5-point stop → $750 risk, 3 ES; other markets need a stop', async () => {
  const p = B.riskPlan({ account: 150000, market: 'ES', stop: 5 });
  assert.strictEqual(p.risk, 750); assert.strictEqual(p.size, 3); assert.strictEqual(p.sym, 'ES');
  assert.match(B.riskPlan({ account: 50000, market: 'GC' }).error, /stop in points for GC/);
  assert.match(B.riskPlan({ account: 25000, market: 'MNQ', stop: 100 }).text, /Even 1 MNQ risks \$200/);
  const r = await (await signed(cmd('risk', [['account', 50000]]))).json();
  assert.strictEqual(r.data.flags, 64); // only you see it unless you share
  assert.strictEqual((await (await signed(cmd('risk', [['account', 50000], ['share', true]]))).json()).data.flags, 0);
});
await t('/dtc: 11 steps as buttons; ticking updates the message; only its owner can tick; Reset clears', async () => {
  const r = await (await signed(cmd('dtc'))).json();
  const buttons = r.data.components.flatMap((row) => row.components);
  assert.strictEqual(buttons.length, 12);
  assert.ok(r.data.components.every((row) => row.components.length <= 5));
  assert.ok(buttons.every((b) => b.custom_id.length <= 100 && b.label.length <= 80));
  const click = (custom_id, message, user = USER) => signed({ type: 3, guild_id: GUILD, member: { user, roles: [] }, message, data: { custom_id, component_type: 2 } });
  const one = await (await click(`dtc:3:${USER.id}`, r.data)).json();
  assert.strictEqual(one.type, 7);
  assert.match(one.data.content, /· 1\/11/);
  const two = await (await click(`dtc:5:${USER.id}`, one.data)).json();
  assert.match(two.data.content, /· 2\/11/);
  assert.match(two.data.content, /✅ \*\*3\.\*\*/);
  const back = await (await click(`dtc:3:${USER.id}`, two.data)).json();
  assert.match(back.data.content, /· 1\/11/);
  const other = await (await click(`dtc:1:${USER.id}`, back.data, { id: '600000000000000002', username: 'x' })).json();
  assert.strictEqual(other.type, 4); assert.strictEqual(other.data.flags, 64);
  let msg = back.data;
  for (let k = 1; k <= 11; k++) if (!/✅ \*\*/.test(msg.content.split('\n')[k])) msg = (await (await click(`dtc:${k}:${USER.id}`, msg)).json()).data;
  assert.match(msg.content, /Checklist done/);
  assert.match((await (await click(`dtc:reset:${USER.id}`, msg)).json()).data.content, /· 0\/11/);
});
await t('/glossary: "fvg" finds Fair Value Gap; autocomplete narrows the list; unknown terms say so', async () => {
  assert.strictEqual(B.lookup('fvg').term[0], 'Fair Value Gap (FVG)');
  assert.strictEqual(B.lookup('stop hunt').term[0], 'Liquidity Grab / Stop Hunt');
  assert.strictEqual(B.lookup('PDL').term[0], 'PDH / PDL (Previous Day High / Low)');
  assert.strictEqual(B.lookup('50%').term[0], 'Equilibrium (EQ or 50%)');
  const ac = await (await signed({ type: 4, data: { name: 'glossary', options: [{ name: 'term', value: 'disp', focused: true }] } })).json();
  assert.deepStrictEqual(ac, { type: 8, data: { choices: [{ name: 'Displacement Candle', value: 'Displacement Candle' }] } });
  const all = await (await signed({ type: 4, data: { name: 'glossary', options: [{ name: 'term', value: '', focused: true }] } })).json();
  assert.strictEqual(all.data.choices.length, 25);
  assert.match((await (await signed(cmd('glossary', [['term', 'zzzz']]))).json()).data.content, /isn't in the guide's glossary/);
});
await t('/md, /mindset, /sessions and /tracker answer within one message', async () => {
  for (const [name, o] of [['md', []], ['mindset', []], ['mindset', [['topic', 'loss']]], ['mindset', [['topic', 'control']]], ['sessions', []], ['tracker', []]]) {
    const r = await (await signed(cmd(name, o))).json();
    assert.strictEqual(r.type, 4); assert.ok(r.data.content.length <= 2000, name);
  }
  const tr = await (await signed(cmd('tracker'))).json();
  assert.strictEqual(tr.data.components[0].components[0].url, 'https://saintjalon.github.io/combine-tracker/');
});
await t('/recap opens a form; the post reads the guide back to you', async () => {
  const m = await (await signed(cmd('recap'))).json();
  assert.strictEqual(m.type, 9);
  assert.strictEqual(m.data.components.length, 5);
  for (const row of m.data.components) assert.ok(row.components[0].label.length <= 45);
  const submit = (values, custom_id = 'recap') => signed({ type: 5, guild_id: GUILD, member: { user: USER }, data: { custom_id, components: Object.entries(values).map(([k, v]) => ({ type: 1, components: [{ type: 4, custom_id: k, value: v }] })) } });
  const green = await (await submit({ account: 'TopStep 50K', pnl: '+$1,250', trades: '3', plan: 'no', note: 'Chased the second one.' })).json();
  const e = green.data.embeds[0];
  assert.match(e.description, /\*\*\+\$1,250\*\* · 3 trades · ❌ off plan\nTopStep 50K/);
  assert.match(e.fields.at(-1).value, /two-trade max[\s\S]*off-plan/);
  assert.strictEqual(e.author.name, 'Jay');
  assert.deepStrictEqual(green.data.allowed_mentions, { parse: [] });
  const red = await (await submit({ pnl: '-250', trades: '1', plan: 'yes' })).json();
  assert.match(red.data.embeds[0].fields.at(-1).value, /Losses are tuition/);
  const bad = await (await submit({ pnl: 'lots', trades: '2', plan: 'maybe', note: 'keep me' })).json();
  assert.strictEqual(bad.data.flags, 64); assert.match(bad.data.content, /P&L "lots"[\s\S]*yes or no[\s\S]*keep me/);
  // newer Discord forms wrap each input in a label component
  const labelled = await (await signed({ type: 5, member: { user: USER }, data: { custom_id: 'journal', components: [{ type: 18, component: { type: 4, custom_id: 'day', value: 'Waited for displacement.' } }, { type: 18, component: { type: 4, custom_id: 'discipline', value: '5' } }] } })).json();
  assert.match(labelled.data.embeds[0].fields.at(-1).value, /★★★★★ 5\/5/);
  assert.strictEqual((await (await submit({ trade: 'NQ', stage: 'Learning', goal: 'Read the guide' }, 'intro')).json()).data.embeds[0].title, '👋 Say hi to Jay');
});
await t('role buttons add, then remove, the role — and only the self-serve ones', async () => {
  const s = fakeDiscord();
  s.roles.push({ id: '555', name: 'Funded' }, { id: '556', name: 'Mentor' });
  const press = (custom_id, roles = []) => signed({ type: 3, guild_id: GUILD, member: { user: USER, roles }, data: { custom_id } });
  assert.match((await (await press('role:funded')).json()).data.content, /Added \*\*💰 Funded\*\*/);
  assert.deepStrictEqual(s.memberRoles, ['555']);
  assert.match((await (await press('role:funded', ['555'])).json()).data.content, /Removed \*\*Funded\*\*/);
  assert.deepStrictEqual(s.memberRoles, []);
  assert.match((await (await press('role:mentor')).json()).data.content, /isn't a role I hand out/);
  assert.deepStrictEqual(s.memberRoles, []);
});

// ── the calendar ──
await t('Eastern time either side of daylight saving', async () => {
  assert.strictEqual(B.etToUtc(2026, 1, 5, 9, 30), Date.UTC(2026, 0, 5, 14, 30)); // EST
  assert.strictEqual(B.etToUtc(2026, 7, 6, 9, 30), Date.UTC(2026, 6, 6, 13, 30)); // EDT
  assert.strictEqual(B.etToUtc(2026, 3, 9, 9, 30), Date.UTC(2026, 2, 9, 13, 30)); // day after the switch
  assert.deepStrictEqual((({ y, mo, d, h, mi, dow }) => [y, mo, d, h, mi, dow])(B.etParts(Date.UTC(2026, 10, 2, 4, 30))), [2026, 11, 1, 23, 30, 0]);
});
await t('market holidays match the tracker\'s rules', async () => {
  assert.strictEqual(B.holidayOn('2026-04-03'), 'Good Friday');
  assert.strictEqual(B.holidayOn('2026-11-26'), 'Thanksgiving');
  assert.strictEqual(B.holidayOn('2026-07-03'), 'Independence Day'); // July 4 is a Saturday
  assert.strictEqual(B.holidayOn('2026-06-19'), 'Juneteenth');
  assert.strictEqual(B.holidayOn('2027-12-24'), 'Christmas'); // Saturday → Friday
  assert.strictEqual(B.holidayOn('2027-12-31'), null); // New Year's 2028 is a Saturday — not made up
  assert.strictEqual(B.holidayOn('2026-10-21'), null);
});
await t('sessions: Wednesday 10 AM ET — London and New York open, Tokyo opens tonight', async () => {
  const now = Date.UTC(2026, 9, 21, 14); // 10:00 EDT
  const [tokyo, london, ny, am] = B.SESSIONS.map((s) => B.sessionWindow(s, now));
  assert.ok(!tokyo.now && tokyo.open === Date.UTC(2026, 9, 21, 23));
  assert.ok(london.now && london.close === Date.UTC(2026, 9, 21, 15));
  assert.ok(ny.now && am.now);
});
await t('sessions: Saturday is closed — Tokyo reopens Sunday 7 PM, New York Monday 8 AM; holidays skip New York', async () => {
  const sat = Date.UTC(2026, 9, 24, 16);
  const [tokyo, london, ny] = B.SESSIONS.map((s) => B.sessionWindow(s, sat));
  assert.strictEqual(tokyo.open, Date.UTC(2026, 9, 25, 23));
  assert.strictEqual(london.open, Date.UTC(2026, 9, 26, 6));
  assert.strictEqual(ny.open, Date.UTC(2026, 9, 26, 12));
  const thanksgiving = Date.UTC(2026, 10, 26, 13);
  assert.strictEqual(B.sessionWindow(B.SESSIONS[2], thanksgiving).open, Date.UTC(2026, 10, 27, 13)); // Friday 8 AM EST
  assert.match(B.sessionsText(thanksgiving), /Thanksgiving/);
});
await t('the trading day: 8:00 prep (Mondays add last week\'s levels), 9:30 open pings alerts, 12:00, 3:00 PM, Sunday review', async () => {
  const at = (mo, d, h, mi) => B.duePosts(B.etToUtc(2026, mo, d, h, mi));
  const mon = at(10, 19, 8, 0);
  assert.deepStrictEqual(mon.map((p) => p.channel), ['premarket-dtc']);
  assert.match(mon[0].content, /New week/);
  assert.ok(!/New week/.test(at(10, 20, 8, 0)[0].content));
  assert.deepStrictEqual(at(10, 19, 9, 30).map((p) => [p.channel, p.ping]), [['ny-session', 'alerts']]);
  assert.deepStrictEqual(at(10, 19, 12, 0).map((p) => p.channel), ['ny-session']);
  assert.deepStrictEqual(at(10, 19, 15, 0).map((p) => p.channel), ['daily-recaps']);
  assert.deepStrictEqual(at(10, 25, 18, 0).map((p) => p.channel), ['weekly-review']);
  for (const [mo, d, h, mi] of [[10, 19, 8, 30], [10, 19, 9, 0], [10, 24, 8, 0], [10, 24, 9, 30], [10, 25, 8, 0]]) assert.deepStrictEqual(at(mo, d, h, mi), []);
  // Thanksgiving: a study-day note at 8:00 and nothing else
  assert.match(at(11, 26, 8, 0)[0].content, /Thanksgiving — no regular New York session/);
  for (const [h, mi] of [[9, 30], [12, 0], [15, 0]]) assert.deepStrictEqual(at(11, 26, h, mi), []);
});
await t('the cron trigger posts into the right channel and pings only the alerts role', async () => {
  const s = fakeDiscord();
  s.channels.push({ id: '901', name: 'ny-session', type: 0 });
  s.roles.push({ id: '902', name: 'NY Open Alerts' });
  s.messages['901'] = [];
  const sent = await B.runScheduled(ENV, B.etToUtc(2026, 10, 21, 9, 30));
  assert.deepStrictEqual(sent, ['ny-session']);
  const m = s.messages['901'][0];
  assert.match(m.content, /^🔔 <@&902> \*\*New York is open/);
  assert.deepStrictEqual(m.allowed_mentions, { roles: ['902'] });
  assert.deepStrictEqual(await B.runScheduled(ENV, B.etToUtc(2026, 10, 21, 10, 0)), []);
});

// ── setup ──
await t('setup builds everything, a little at a time, never over the free plan\'s 50 requests a run', async () => {
  const s = fakeDiscord();
  const { r, rounds } = await setupAll(ENV, s);
  assert.ok(rounds.every((k) => k <= 45), 'requests per run: ' + rounds);
  assert.ok(rounds.length > 1);
  assert.strictEqual(r.invite, 'https://discord.gg/abc123');
  assert.deepStrictEqual(s.commands.map((c) => c.name), B.COMMANDS.map((c) => c.name));
  for (const role of B.ROLES) assert.strictEqual(s.roles.filter((x) => x.name === role.name).length, 1, role.name);
  for (const cat of B.CATEGORIES) {
    const parent = s.channels.find((c) => c.name === cat.name && c.type === 4);
    for (const ch of cat.channels) {
      const c = s.channels.filter((x) => x.name === ch.name && x.type === (ch.voice ? 2 : 0));
      assert.strictEqual(c.length, 1, ch.name);
      assert.strictEqual(c[0].parent_id, parent.id, ch.name + ' sits in ' + cat.name);
      if (ch.readOnly) assert.deepStrictEqual(c[0].permission_overwrites, [{ id: GUILD, type: 0, deny: '2048' }, { id: BOT, type: 1, allow: String(1024 + 2048 + 16384 + 65536) }]);
      if (ch.posts) {
        const posted = s.messages[c[0].id].slice().reverse();
        assert.strictEqual(posted.length, ch.posts.length, ch.name);
        for (const p of posted) assert.ok(!/\{[#/@]|\{tracker\}/.test(p.content), 'unfilled placeholder in #' + ch.name);
      }
    }
  }
  // the new server's own #general moved into CONNECT; the default General voice channel is left alone
  assert.strictEqual(s.channels.find((c) => c.id === '701').parent_id, s.channels.find((c) => c.name === '🤝 CONNECT').id);
  assert.strictEqual(s.channels.filter((c) => c.name === 'general').length, 1);
  // links in posts are real: channels, clickable commands, the tracker
  const welcome = s.messages[s.channels.find((c) => c.name === 'welcome').id].slice().reverse();
  assert.match(welcome[0].content, /<#\d+>/);
  assert.match(welcome[1].content, new RegExp(`</dtc:${s.commands[0].id}>`));
  assert.match(welcome[1].content, /saintjalon\.github\.io\/combine-tracker/);
  // the role picker's buttons
  const picker = s.messages[s.channels.find((c) => c.name === 'pick-your-roles').id][0];
  assert.deepStrictEqual(picker.components.flatMap((row) => row.components.map((b) => b.custom_id)), ['role:learning', 'role:eval', 'role:funded', 'role:paid', 'role:nq', 'role:gold', 'role:oil', 'role:alerts']);
});
await t('setup run again adds nothing; a rate limit mid-post resumes without duplicates', async () => {
  const s = fakeDiscord();
  await setupAll(ENV, s);
  s.writes = [];
  await setupAll(ENV, s);
  assert.deepStrictEqual(s.writes.filter((w) => !/\/commands$|\/invites$/.test(w)), []);

  let posts = 0;
  const s2 = fakeDiscord({ failOn: (m, p) => m === 'POST' && /\/messages$/.test(p) && ++posts === 6 });
  let waited = false;
  for (let round = 0; round < 50; round++) {
    const r = await B.runSetup(ENV, { round });
    if (r.wait) { waited = true; assert.ok(r.wait >= 1500); }
    if (r.done) break;
  }
  assert.ok(waited);
  for (const ch of allChannels.filter((c) => c.posts)) {
    const id = s2.channels.find((c) => c.name === ch.name && c.type === 0).id;
    assert.strictEqual(s2.messages[id].length, ch.posts.length, ch.name);
  }
});
await t('setup explains a missing permission and a missing setting', async () => {
  const s = fakeDiscord();
  const keep = globalThis.fetch;
  globalThis.fetch = async (url, o) => (/\/roles$/.test(url) && o.method === 'POST' ? new Response(JSON.stringify({ code: 50013, message: 'Missing Permissions' }), { status: 403 }) : keep(url, o));
  const r = await B.runSetup(ENV, { round: 1 });
  assert.match(r.error, /missing a permission/);
  globalThis.fetch = keep;
  assert.match((await B.runSetup({ DISCORD_TOKEN: 'tok' })).error, /DISCORD_APP_ID, GUILD_ID/);
  void s;
});
await t('the setup page needs the setup key', async () => {
  fakeDiscord();
  const post = (key, env = ENV) => worker.fetch(new Request('https://bot.example.workers.dev/setup', { method: 'POST', body: JSON.stringify({ key, round: 0 }) }), env);
  assert.strictEqual((await post('wrong')).status, 403);
  assert.strictEqual((await post('')).status, 403);
  assert.match((await (await post('x', { DISCORD_TOKEN: 'tok' })).json()).error, /SETUP_KEY/);
  const ok = await (await post('open-sesame')).json();
  assert.ok(ok.log.length > 0 && !ok.error);
  const page = await (await worker.fetch(new Request('https://bot.example.workers.dev/setup'), ENV)).text();
  assert.match(page, new RegExp(`client_id=${APP}&scope=bot%20applications\\.commands&permissions=${B.BOT_PERMISSIONS}`));
  assert.match(page, /https:\/\/bot\.example\.workers\.dev\/interactions/);
});

console.log(`\n${n} passed`);
