const inquiries = require('../lib/inquiries');
const store = require('../lib/private-store');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if ((req.method === 'GET' && req.query?.health === '1') || req.method === 'HEAD') {
    try {
      const status = await inquiries.health();
      const code = status.ready && !status.delayed ? 200 : 503;
      return req.method === 'HEAD' ? res.status(code === 200 ? 204 : code).end() : res.status(code).json(status);
    } catch { return req.method === 'HEAD' ? res.status(503).end() : res.status(503).json({ ready: false, backup: false }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, HEAD'); return res.status(405).json({ ok: false }); }
  if (req.headers.origin && !inquiries.ORIGIN.test(req.headers.origin)) return res.status(403).json({ ok: false });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 16000) return res.status(400).json({ ok: false });
  const body = req.body;
  if (body.website) return res.status(200).json({ ok: true, delivery: 'sent' });
  let fields;
  try { fields = inquiries.fields(body); }
  catch { return res.status(400).json({ ok: false, error: 'missing-fields' }); }
  const id = body.requestId || inquiries.newId();
  if (typeof id !== 'string' || !inquiries.ID.test(id)) return res.status(400).json({ ok: false, error: 'invalid-request-id' });
  if (!store.configured()) return res.status(503).json({ ok: false, error: 'backup-unavailable' });
  try {
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!await inquiries.allowed(ip)) { res.setHeader('Retry-After', '3600'); return res.status(429).json({ ok: false, error: 'try-later' }); }
    // Acknowledgement is impossible until the private copy and outbox entry exist.
    await inquiries.save(fields, id);
  } catch (error) {
    console.error('INQUIRY_BACKUP_FAILED', { id });
    return res.status(error.message === 'request-conflict' ? 409 : 503).json({ ok: false, error: 'backup-unavailable' });
  }
  try {
    const record = await inquiries.deliver(id);
    return res.status(record.status === 'sent' ? 200 : 202).json({ ok: true, id, delivery: record.status === 'sent' ? 'sent' : 'saved' });
  } catch {
    console.error('INQUIRY_DELIVERY_DEFERRED', { id });
    return res.status(202).json({ ok: true, id, delivery: 'saved' });
  }
};
