const { createHash, timingSafeEqual } = require('node:crypto');
const { retryPending } = require('../lib/inquiries');
const hash = value => createHash('sha256').update(value).digest();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(hash(req.headers.authorization || ''), hash('Bearer ' + secret))) return res.status(401).end();
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  try { return res.status(200).json({ ok: true, results: await retryPending() }); }
  catch { console.error('INQUIRY_RETRY_FAILED'); return res.status(503).json({ ok: false }); }
};
