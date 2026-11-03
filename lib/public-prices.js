const SOURCE = 'https://listingpixl.hd.pics/order';
const PRODUCTS = {
  '449299': 'Essential', '451046': 'Standard', '451048': 'Marketing',
  '451049': 'Luxury', '451050': 'Signature', '451051': 'Aerial Drone Photos',
  '451052': 'Cinematic Walkthrough Video', '451054': 'Matterport 3D Tour',
  '451056': 'Virtual Twilight — 1 Photo', '451058': 'Virtual Twilight — 3 Pack',
  '451059': '2D Floor Plan', '451248': 'Virtual Staging (per room)', '451251': 'Marketing Kit',
};

// Public prices, always visible. Never show "See checkout" in place of a price:
// Will wants transparency, and the live HDPhotoHub fetch from Vercel was
// failing (Cloudflare blocking the Vercel/Node fetch), which left every
// package and add-on showing "See checkout" instead of a price.
//
// FALLBACK_PRICES is the published public menu, verified 2026-11-03.
// Adjusted 2026-11-03 at Will's direction: every price at least 5% over
// the NJ / South Jersey market average, where it was under. HDPhotoHub
// checkout now matches these same numbers, verified live 2026-11-03
// ~14:27 UTC: all 13 prices identical to this catalog. (Note: a
// Standard Repeat Client tier at $265.05 — 5% off the old $279 — was
// still showing in Studio at that time; it is a client-specific price,
// not in the public order-page inputs, so the site does not show it,
// but checkout for repeat clients may still charge it.) Update
// HDPhotoHub AND this catalog together whenever the menu changes, or
// the site and checkout will disagree. Long-term goal: the site auto-follows HDPhotoHub (see
// investigation notes in the branch report) so this catalog is only a
// last-resort snapshot, never the primary source.
const FALLBACK_CHECKED_AT = '2026-11-03T14:30:00.000Z';
const FALLBACK_PRICES = {
  '449299': { name: 'Essential', price: 200 },
  '451046': { name: 'Standard', price: 290 },
  '451048': { name: 'Marketing', price: 389 },
  '451049': { name: 'Luxury', price: 549 },
  '451050': { name: 'Signature', price: 815 },
  '451051': { name: 'Aerial Drone Photos', price: 145 },
  '451052': { name: 'Cinematic Walkthrough Video', price: 265 },
  '451054': { name: 'Matterport 3D Tour', price: 185 },
  '451056': { name: 'Virtual Twilight — 1 Photo', price: 35 },
  '451058': { name: 'Virtual Twilight — 3 Pack', price: 99 },
  '451059': { name: '2D Floor Plan', price: 90 },
  '451248': { name: 'Virtual Staging (per room)', price: 35 },
  '451251': { name: 'Marketing Kit', price: 39 },
};

function getFallbackPrices() {
  return {
    source: SOURCE,
    checkedAt: FALLBACK_CHECKED_AT,
    currency: 'USD',
    fallback: true,
    prices: structuredClone(FALLBACK_PRICES),
  };
}

function parsePrices(html) {
  const prices = {};
  for (const tag of html.match(/<input\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1].toLowerCase(), m[3]]));
    const id = attrs['hd-pid'];
    if (!Object.hasOwn(PRODUCTS, id)) continue;
    if (prices[id] || attrs.name !== 'products' || !/^\d+(?:\.\d{1,2})?$/.test(attrs['hd-price'] || '')) throw Error('Invalid price markup');
    const price = Number(attrs['hd-price']);
    if (price <= 0 || price > 100000 || attrs['hd-price'] !== attrs['hd-regprice']) throw Error('Non-public or invalid price');
    prices[id] = { name: PRODUCTS[id], price };
  }
  if (Object.keys(prices).length !== Object.keys(PRODUCTS).length) throw Error('Incomplete catalog');
  return prices;
}

async function getPublicPrices(fetcher = fetch) {
  const response = await fetcher(SOURCE, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw Error('Price source unavailable');
  const html = await response.text();
  if (html.length > 1500000) throw Error('Unexpected response size');
  return { source: SOURCE, checkedAt: new Date().toISOString(), currency: 'USD', prices: parsePrices(html) };
}

// Live HDPhotoHub prices first; the verified public fallback when that
// fetch fails, so the site always shows a price and never "See checkout".
async function getPublicPricesWithFallback(fetcher = fetch) {
  try {
    return await getPublicPrices(fetcher);
  } catch (error) {
    console.error('Public pricing refresh failed, using verified fallback:', error.message);
    return getFallbackPrices();
  }
}

function renderPrices(html, catalog) {
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const checkedAt = Date.parse(catalog.checkedAt);
  if (!Number.isFinite(checkedAt)) throw Error('Missing price verification time');
  const seen = new Set();
  const result = html.replace(/<span\b([^>]*\bdata-hd-price=(["'])(\d+)\2[^>]*)>[^<]*<\/span>/g, (whole, attrs, quote, id) => {
    if (!catalog.prices[id] || seen.has(id)) throw Error('Unexpected price placeholder');
    seen.add(id);
    const unit = /\bdata-price-unit=(["']) \/ room\1/.test(attrs) ? ' / room' : '';
    return '<span' + attrs + ' data-price-checked-at="' + new Date(checkedAt).toISOString() + '">' + currency.format(catalog.prices[id].price).replace(/\.00$/, '') + unit + '</span>';
  });
  if (seen.size !== Object.keys(PRODUCTS).length) throw Error('Incomplete price placeholders');
  return result;
}

module.exports = { SOURCE, PRODUCTS, parsePrices, getPublicPrices, getPublicPricesWithFallback, getFallbackPrices, FALLBACK_CHECKED_AT, renderPrices };
