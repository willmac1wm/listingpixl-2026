const { SOURCE, getPublicPricesWithFallback, parsePrices } = require('../lib/public-prices');

async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  // Prices are public and always shown. The live HDPhotoHub menu is tried
  // first; when that fetch fails the verified fallback catalog is returned
  // (flagged with fallback: true) instead of a 503 / "See checkout".
  const catalog = await getPublicPricesWithFallback();
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');
  return res.status(200).json(catalog);
}
module.exports = handler;
module.exports.parsePrices = parsePrices;
