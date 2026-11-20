import { json } from './_lib/util.js';

// Live product list, read from the public Shopify storefront.
const STORE = process.env.PUBLIC_STORE_URL || 'https://haveyoudiedbefore.online';

export function mapProduct(p) {
  const type = (p.product_type || '').toLowerCase(), title = p.title || '';
  let slot = 'belt', cat = 'smith', kind;
  if (type === 'top') { slot = 'top'; cat = 'clothing'; }
  else if (type === 'bottom') { if (/boxer|brief|underwear/i.test(title)) { slot = 'under'; cat = 'clothing'; } else { slot = 'bottom'; cat = 'clothing'; } }
  else if (type === 'hat' || /beanie|cap|hat/i.test(title)) { slot = 'hat'; cat = 'smith'; kind = /cap/i.test(title) ? 'cap' : 'beanie'; }
  else if (/belt/i.test(title)) { slot = 'belt'; cat = 'smith'; }
  else if (/chain|ring|necklace|pendant|rosary/i.test(title)) { slot = /ring/i.test(title) ? 'ring' : 'neck'; cat = 'smith'; }
  const price = p.variants && p.variants[0] ? `$${Math.round(parseFloat(p.variants[0].price))}` : '';
  const img = p.images && p.images[0] ? p.images[0].src : '';
  const available = (p.variants || []).some(v => v.available !== false);
  return { id: p.handle, name: title, price, cat, slot, kind, tee: /\btee\b|t-shirt/i.test(title), img, handle: p.handle, available };
}

export default async function handler(req, res) {
  try {
    const r = await fetch(`${STORE.replace(/\/$/, '')}/products.json?limit=250`, { headers: { 'User-Agent': 'hydb-village' } });
    if (!r.ok) throw new Error('store ' + r.status);
    const { products = [] } = await r.json();
    json(res, 200, { store: STORE, products: products.map(mapProduct) }, 's-maxage=600, stale-while-revalidate=3600');
  } catch (e) {
    json(res, 502, { error: 'catalog_unavailable' });
  }
}
