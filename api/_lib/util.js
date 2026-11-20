import crypto from 'node:crypto';

export const json = (res, status, body, cache) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
};

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

// Signed guest pass: proves this browser showed a real order. No secrets inside.
const b64u = (buf) => Buffer.from(buf).toString('base64url');
export function signPass(payload) {
  const secret = process.env.SESSION_SECRET; if (!secret) throw new Error('SESSION_SECRET missing');
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}
export function readPass(token) {
  const secret = process.env.SESSION_SECRET; if (!secret || !token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.'); if (!body || !sig) return null;
  const want = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); if (p.exp && Date.now() > p.exp) return null; return p; } catch { return null; }
}

// Upstash Redis over REST (works with Vercel's Upstash / KV integration env names too)
export function redisConfigured() {
  return !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN));
}
export async function redis(...cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
