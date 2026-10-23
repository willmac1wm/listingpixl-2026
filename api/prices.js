// Public prices only: fixed upstream, no cookies, account keys, or client input.
const SOURCE = 'https://listingpixl.hd.pics/order';
const PRODUCTS = {
  '449299': 'Essential', '451046': 'Standard', '451048': 'Marketing',
  '451049': 'Luxury', '451050': 'Signature', '451051': 'Aerial Drone Photos',
  '451052': 'Cinematic Walkthrough Video', '451054': 'Matterport 3D Tour',
  '451056': 'Virtual Twilight (1 Photo)', '451058': 'Virtual Twilight (3 Photos)',
  '451059': '2D Floor Plan', '451248': 'Virtual Staging', '451251': 'Marketing Kit'
};

function parsePrices(html) {
  const prices = {};
  for (const tag of html.match(/<input\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1].toLowerCase(), m[3]]));
    const id = attrs['hd-pid'];
    if (!PRODUCTS[id]) continue;
    if (prices[id] || attrs.name !== 'products' || !/^\d+(?:\.\d{1,2})?$/.test(attrs['hd-price'] || '')) throw new Error('Invalid price markup');
    const price = Number(attrs['hd-price']);
    if (price <= 0 || price > 100000 || attrs['hd-price'] !== attrs['hd-regprice']) throw new Error('Non-public or invalid price');
    prices[id] = { name: PRODUCTS[id], price };
  }
  // Fail closed if the catalog changes rather than silently using old prices.
  if (Object.keys(prices).length !== Object.keys(PRODUCTS).length) throw new Error('Incomplete catalog');
  return prices;
}

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  try {
    const upstream = await fetch(SOURCE, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
    if (!upstream.ok || !upstream.headers.get('content-type')?.includes('text/html')) throw new Error('Price source unavailable');
    const html = await upstream.text();
    if (html.length > 1500000) throw new Error('Unexpected response size');
    const prices = parsePrices(html);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');
    return res.status(200).json({ source: SOURCE, checkedAt: new Date().toISOString(), currency: 'USD', prices });
  } catch (error) {
    console.error('Public pricing refresh failed:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Current prices are available at checkout.', source: SOURCE });
  }
}
module.exports = handler;
module.exports.parsePrices = parsePrices;
