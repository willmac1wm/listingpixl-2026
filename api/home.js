const fs = require('node:fs');
const path = require('node:path');
const { getPublicPrices, renderPrices } = require('../lib/public-prices');

module.exports = async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  try {
    // Read HDPhotoHub directly: caching this HTML must not add another cache
    // period on top of /api/prices. No visitor cookies or client rates are used.
    html = renderPrices(html, await getPublicPrices());
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');
  } catch (error) {
    console.error('Homepage price rendering failed:', error.message);
    // The original checkout links and client refresh remain usable during an outage.
    res.setHeader('Cache-Control', 'no-store');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(req.method === 'HEAD' ? '' : html);
};
