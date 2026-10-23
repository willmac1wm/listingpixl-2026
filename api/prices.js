const { SOURCE, getPublicPrices, parsePrices } = require('../lib/public-prices');

async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  try {
    const catalog = await getPublicPrices();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');
    return res.status(200).json(catalog);
  } catch (error) {
    console.error('Public pricing refresh failed:', error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Current prices are available at checkout.', source: SOURCE });
  }
}
module.exports = handler;
module.exports.parsePrices = parsePrices;
