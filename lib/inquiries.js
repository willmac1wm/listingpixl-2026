const nodemailer = require('nodemailer');
const { createHash, randomUUID } = require('node:crypto');
const store = require('./private-store');
const LIMITS = { name: 100, email: 200, phone: 40, package: 60, address: 200, date: 10, message: 2000 };
const ID = /^\d{13}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ORIGIN = /^https:\/\/(www\.)?listingpixl\.com$|^https:\/\/listingpixl-2026-[a-z0-9-]+\.vercel\.app$/;
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
function fields(body) {
  const result = {};
  for (const [key, max] of Object.entries(LIMITS)) result[key] = clean(body[key], max);
  for (const key of Object.keys(LIMITS).filter(key => key !== 'message')) result[key] = result[key].replace(/[\r\n]+/g, ' ');
  if (!result.name || !result.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw Error('missing-fields');
  return result;
}
function recordPath(id) { if (!ID.test(id)) throw Error('Invalid inquiry ID'); return 'inquiries/records/' + id + '.json'; }
function queuePath(id) { recordPath(id); return 'inquiries/queue/' + id + '.json'; }
function newId() { return Date.now() + '-' + randomUUID(); }
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

async function save(f, id = newId(), storage = store) {
  const record = { id, createdAt: new Date().toISOString(), fields: f, fingerprint: digest(f), status: 'queued', attempts: 0 };
  const saved = await storage.create(recordPath(id), record);
  if (saved.value.fingerprint !== record.fingerprint) throw Error('request-conflict');
  if (saved.value.status !== 'sent') await storage.create(queuePath(id), { id, createdAt: saved.value.createdAt });
  return saved.value;
}

async function allowed(ip, storage = store, now = Date.now()) {
  const hour = Math.floor(now / 3600000);
  const key = digest([hour, ip]);
  const path = 'inquiries/limits/' + new Date(now).toISOString().slice(0, 10) + '/' + key + '.json';
  let current = await storage.create(path, { count: 1 });
  if (current.created) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (current.value.count >= 8) return false;
    try { await storage.write(path, { count: current.value.count + 1 }, current.etag); return true; }
    catch (error) {
      if (error.name !== 'BlobPreconditionFailedError') throw error;
      current = await storage.read(path);
    }
  }
  return false;
}

async function sendEmail(record) {
  if (!process.env.GMAIL_APP_PASSWORD) { const err = Error('Mail is not configured'); err.code = 'EAUTH'; throw err; }
  const user = process.env.GMAIL_USER || 'ListingPixl.Media@gmail.com';
  const f = record.fields;
  const text = [
    'New contact inquiry from listingpixl.com', '', 'Reference: ' + record.id,
    'Name: ' + f.name, 'Email: ' + f.email, 'Phone: ' + (f.phone || 'Not given'),
    'Property address: ' + (f.address || 'Not given'), 'Preferred date: ' + (f.date || 'Not given'),
    'Package: ' + (f.package || 'Not sure yet'), '', 'Message:', f.message, '',
    'Received ' + new Date(record.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' (Eastern).',
    'A private backup is available at https://www.listingpixl.com/staff/inquiries .',
    'Reply to this email to answer ' + f.name + ' directly.',
  ].join('\n');
  return nodemailer.createTransport({ service: 'gmail', connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
    auth: { user, pass: process.env.GMAIL_APP_PASSWORD } }).sendMail({
    from: { name: 'Listing Pixl website', address: user }, to: process.env.BOOKING_TO || user,
    replyTo: { name: f.name, address: f.email }, subject: 'Website question from ' + f.name,
    messageId: '<inquiry-' + record.id + '@listingpixl.com>', text,
  });
}

async function deliver(id, { storage = store, send = sendEmail, confirmedRetry = false, now = Date.now() } = {}) {
  let current = await storage.read(recordPath(id));
  if (!current) throw Error('Inquiry not found');
  const record = current.value;
  if (record.status === 'sent') { await storage.remove(queuePath(id)).catch(() => {}); return record; }
  if (record.status === 'sending' && Date.parse(record.leaseUntil) > now) return record;
  if (['sending', 'uncertain'].includes(record.status) && !confirmedRetry) return record;
  if (!confirmedRetry && Date.parse(record.nextAttemptAt || '') > now) return record;
  const sending = { ...record, status: 'sending', attempts: record.attempts + 1, leaseUntil: new Date(now + 90000).toISOString() };
  // Conditional write claims the send. Another request cannot send the same lead concurrently.
  try { current = await storage.write(recordPath(id), sending, current.etag); }
  catch (error) {
    if (error.name === 'BlobPreconditionFailedError') return (await storage.read(recordPath(id))).value;
    throw error;
  }
  let completed;
  try {
    const sent = await send(sending);
    completed = { ...sending, status: 'sent', sentAt: new Date().toISOString(), messageId: sent.messageId || '', lastError: null };
  } catch (error) {
    // A timeout during DATA may have been accepted by Gmail. Require a human
    // check before retrying that ambiguous case, to avoid duplicate emails.
    const safeToRetry = ['EAUTH', 'ECONNECTION', 'EDNS', 'ECONNREFUSED', 'EENVELOPE', 'ETLS'].includes(error.code)
      || (error.code === 'EMESSAGE' && Number(error.responseCode) >= 400);
    completed = { ...sending, status: safeToRetry ? 'failed' : 'uncertain', lastError: /^[A-Z0-9_]{1,30}$/.test(error.code || '') ? error.code : 'SEND_FAILED',
      nextAttemptAt: new Date(now + Math.min(86400000, 300000 * 2 ** Math.min(sending.attempts, 8))).toISOString() };
    console.error(safeToRetry ? 'INQUIRY_DELIVERY_FAILED' : 'INQUIRY_DELIVERY_UNCERTAIN', { id, code: completed.lastError });
  }
  delete completed.leaseUntil;
  try { await storage.write(recordPath(id), completed, current.etag); }
  catch (error) { console.error('INQUIRY_STATUS_SAVE_FAILED', { id }); return { ...sending, status: 'uncertain' }; }
  if (completed.status === 'sent') await storage.remove(queuePath(id)).catch(() => {});
  return completed;
}

async function health(storage = store) {
  const pending = await storage.list('inquiries/queue/', { limit: 1 });
  let delayed = false;
  if (pending.items.length) {
    const marker = await storage.read(pending.items[0].path);
    const record = marker && await storage.read(recordPath(marker.value.id));
    delayed = Boolean(record && record.value.status !== 'sent' && Date.now() - Date.parse(record.value.createdAt) > 120000);
  }
  return { ready: Boolean(process.env.GMAIL_APP_PASSWORD), backup: true, delayed };
}

async function retryPending(storage = store) {
  const pending = await storage.list('inquiries/queue/', { limit: 20 });
  const results = [];
  for (const item of pending.items) {
    const marker = await storage.read(item.path);
    if (marker) results.push(await deliver(marker.value.id, { storage }));
  }
  return results.map(record => ({ id: record.id, status: record.status }));
}
module.exports = { ORIGIN, ID, fields, newId, recordPath, queuePath, save, deliver, health, retryPending, allowed };
