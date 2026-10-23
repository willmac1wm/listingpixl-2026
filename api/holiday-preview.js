// A separate, noindex demo renders the current homepage on every request.
// The real homepage never includes the seasonal script until Will approves it.
const fs = require('node:fs');
const path = require('node:path');
const { getPublicPrices, renderPrices } = require('../lib/public-prices');

module.exports = async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  try { html = renderPrices(html, await getPublicPrices()); }
  catch { /* The homepage's normal client price refresh still works. */ }
  html = html.replace('<head>', '<head>\n  <base href="/">\n  <meta name="robots" content="noindex, nofollow">')
    .replace(/<title>[^<]*<\/title>/, '<title>Holiday skin preview | Listing Pixl</title>')
    // Avoid counting visits to this design preview as real marketing traffic.
    .replace(/  <!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->/g, '')
    .replace(/  <!-- Google tag \(gtag\.js\) -->\s*<script[^>]*><\/script>\s*<script>[\s\S]*?<\/script>/g, '')
    .replace('</body>', '  <script src="/holiday-skin.js" data-preview defer></script>\n</body>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(req.method === 'HEAD' ? '' : html);
};
