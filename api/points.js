import { json, readBody, readPass, redis, redisConfigured } from './_lib/util.js';

// Server-side points for guests with a verified order.
// 1 point per 10 seconds of active time. The client reports a heartbeat every ~30s;
// the server only credits the real time since the last heartbeat (capped), and nothing while AFK.
const MS_PER_POINT = 10000, MAX_GAP = 45000;
export const TIERS = [0, 60, 180, 400, 900];

async function state(g) {
  const [ms, spent, tier] = await Promise.all([redis('GET', `ms:${g}`), redis('GET', `spent:${g}`), redis('GET', `tier:${g}`)]);
  const points = Math.floor((+ms || 0) / MS_PER_POINT) - (+spent || 0);
  return { points, tier: +tier || 0 };
}

export default async function handler(req, res) {
  if (!redisConfigured()) return json(res, 200, { enabled: false });
  if (req.method !== 'POST') return json(res, 405, {});
  const { pass, action, active, tier } = await readBody(req);
  const p = readPass(pass); if (!p) return json(res, 401, { enabled: true, error: 'no_pass' });
  const g = p.g, now = Date.now();

  if (action === 'beat') {
    const last = +(await redis('GETSET', `last:${g}`, String(now))) || 0;
    if (active && last && now - last <= MAX_GAP) await redis('INCRBY', `ms:${g}`, String(now - last));
  } else if (action === 'upgrade') {
    const s = await state(g); const want = +tier;
    if (want !== s.tier + 1 || !TIERS[want]) return json(res, 400, { enabled: true, ...s, error: 'bad_tier' });
    if (s.points < TIERS[want]) return json(res, 400, { enabled: true, ...s, error: 'not_enough' });
    await redis('INCRBY', `spent:${g}`, String(TIERS[want])); await redis('SET', `tier:${g}`, String(want));
  }
  return json(res, 200, { enabled: true, ...(await state(g)) });
}
