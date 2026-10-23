const twilio = require('twilio');
const feedback = require('../lib/sms-feedback');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  // Disabled by default: keep HDPhotoHub's existing delivery texts working.
  const token = process.env.TWILIO_AUTH_TOKEN;
  const account = process.env.TWILIO_ACCOUNT_SID;
  const url = process.env.SMS_REPLY_WEBHOOK_URL;
  if (process.env.SMS_FEEDBACK_ENABLED !== 'true' || !token || !account || !url) return res.status(503).end('Two-way SMS is not connected.');
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(415).end();
  const params = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body;
  if (!params || typeof params !== 'object' || Array.isArray(params) || Object.values(params).some(value => typeof value !== 'string')) return res.status(400).end();
  if (!twilio.validateRequest(token, req.headers['x-twilio-signature'] || '', url, params) || params.AccountSid !== account) return res.status(403).end();
  if (!/^SM[a-f0-9]{32}$/i.test(params.MessageSid || '') || !/^\+[1-9]\d{7,14}$/.test(params.From || '') || !/^\+[1-9]\d{7,14}$/.test(params.To || '') || typeof params.Body !== 'string' || params.Body.length > 1600) return res.status(400).end();
  try {
    const xml = await feedback.handle(params);
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    return res.status(200).end(xml);
  } catch {
    console.error('SMS_FEEDBACK_SAVE_FAILED', { sid: params.MessageSid });
    return res.status(503).end(); // Ask Twilio to retry; never discard an unsaved reply.
  }
};
