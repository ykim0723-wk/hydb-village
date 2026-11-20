import { json, readBody, signPass, redis, redisConfigured } from './_lib/util.js';

// Checks an order number + email against Shopify (Admin API) and returns the products in it.
// Env: SHOPIFY_STORE_DOMAIN (xxxx.myshopify.com), SHOPIFY_ADMIN_TOKEN (read_orders), SESSION_SECRET.
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const QUERY = `query($q:String!){ orders(first:5, query:$q){ edges{ node{
  id name email cancelledAt displayFinancialStatus
  lineItems(first:100){ edges{ node{ quantity product{ handle } } } }
} } } }`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const { number, email } = await readBody(req);
  const n = String(number || '').trim().replace(/^#/, '');
  const mail = String(email || '').trim().toLowerCase();
  if (!/^\d{3,12}$/.test(n)) return json(res, 400, { ok: false, msg: 'That doesn’t look like an order number. It’s on your confirmation email, like #1042.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json(res, 400, { ok: false, msg: 'The email you ordered with is needed too.' });

  const domain = process.env.SHOPIFY_STORE_DOMAIN, token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token || !process.env.SESSION_SECRET) return json(res, 503, { ok: false, configured: false, msg: 'Order checking isn’t switched on yet.' });

  // simple brute-force brake: 8 tries per IP per 10 minutes when Redis is available
  if (redisConfigured()) {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'na';
    const k = `try:${ip}`; const c = await redis('INCR', k); if (c === 1) await redis('EXPIRE', k, 600);
    if (c > 8) return json(res, 429, { ok: false, msg: '“Slow down, stranger. Come back in a few minutes.”' });
  }

  const r = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query: QUERY, variables: { q: `name:#${n}` } }),
  });
  if (!r.ok) return json(res, 502, { ok: false, msg: 'The innkeeper can’t reach the ledger right now. Try again shortly.' });
  const j = await r.json();
  const orders = (j.data && j.data.orders && j.data.orders.edges || []).map(e => e.node);
  const order = orders.find(o => o.name.replace(/^#/, '') === n && (o.email || '').toLowerCase() === mail);
  if (!order) return json(res, 404, { ok: false, msg: '“No such order in my ledger under that name and email.”' });
  if (order.cancelledAt || ['VOIDED', 'REFUNDED'].includes(order.displayFinancialStatus)) return json(res, 403, { ok: false, msg: '“That order was cancelled or refunded. No room for it.”' });

  const items = [...new Set(order.lineItems.edges.map(e => e.node.product && e.node.product.handle).filter(Boolean))];
  const guest = order.id.split('/').pop();
  const pass = signPass({ g: guest, n: order.name, exp: Date.now() + 1000 * 60 * 60 * 24 * 90 });
  if (redisConfigured()) await redis('SADD', `items:${guest}`, ...(items.length ? items : ['_none']));
  return json(res, 200, { ok: true, order: { number: order.name, items }, pass });
}
