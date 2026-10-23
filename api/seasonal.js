const { authorized, sameOrigin } = require('./_auth');
const settings = require('../lib/seasonal-settings');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, data) => res.status(status).end(req.method === 'HEAD' ? '' : JSON.stringify(data));
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return send(405, { error: 'Method not allowed.' });
  }
  if (req.method === 'POST') {
    if (!await authorized(req, res)) return send(401, { error: 'Team sign-in required. Refresh the dashboard and sign in again.' });
    // JSON + custom header + exact same HTTPS origin; no cross-site form writes.
    if (req.headers['x-staff'] !== '1' || !sameOrigin(req) || !String(req.headers['content-type'] || '').startsWith('application/json')) {
      return send(403, { error: 'Save the setting from the team dashboard.' });
    }
  }
  try {
    if (req.method === 'POST') {
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
      catch { return send(400, { error: 'Invalid setting.' }); }
      if (typeof body?.enabled !== 'boolean') return send(400, { error: 'Enabled must be true or false.' });
      return send(200, await settings.save(body.enabled));
    }
    // Only the non-sensitive display preference is public, never the private store.
    const value = await settings.read();
    return send(200, { enabled: value.enabled });
  } catch {
    return send(503, { enabled: false, error: 'Seasonal settings are temporarily unavailable. The page stays undecorated.' });
  }
};
