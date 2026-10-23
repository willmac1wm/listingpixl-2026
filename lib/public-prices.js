const SOURCE = 'https://listingpixl.hd.pics/order';
const PRODUCTS = {
  '449299': 'Essential', '451046': 'Standard', '451048': 'Marketing',
  '451049': 'Luxury', '451050': 'Signature', '451051': 'Aerial Drone Photos',
  '451052': 'Cinematic Walkthrough Video', '451054': 'Matterport 3D Tour',
  '451056': 'Virtual Twilight — 1 Photo', '451058': 'Virtual Twilight — 3 Pack',
  '451059': '2D Floor Plan', '451248': 'Virtual Staging (per room)', '451251': 'Marketing Kit',
};

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

module.exports = { SOURCE, PRODUCTS, parsePrices, getPublicPrices, renderPrices };
