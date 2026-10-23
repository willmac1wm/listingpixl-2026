const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { BlobPreconditionFailedError } = require('@vercel/blob');
const prices = require('../lib/public-prices');
const inquiries = require('../lib/inquiries');
const feedback = require('../lib/sms-feedback');

class MemoryStore {
  constructor() { this.items = new Map(); this.version = 0; }
  async read(path) { return structuredClone(this.items.get(path) || null); }
  async write(path, value, etag) {
    const old = this.items.get(path);
    if (etag ? old?.etag !== etag : Boolean(old)) throw new BlobPreconditionFailedError();
    const saved = { value: structuredClone(value), etag: String(++this.version) };
    this.items.set(path, saved);
    return structuredClone(saved);
  }
  async create(path, value) {
    const old = await this.read(path);
    if (old) return { ...old, created: false };
    try { return { ...(await this.write(path, value)), created: true }; }
    catch (error) { const current = await this.read(path); if (current) return { ...current, created: false }; throw error; }
  }
  async remove(path) { this.items.delete(path); }
  async list(prefix, { limit = 50 } = {}) { return { items: [...this.items.keys()].filter(path => path.startsWith(prefix)).sort().slice(0, limit).map(path => ({ path })), cursor: null }; }
}
const sample = () => inquiries.fields({ name: 'Test Agent', email: 'agent@example.com', message: 'Please help plan a shoot.' });
const fixture = () => Object.keys(prices.PRODUCTS).map((id, i) => `<input name="products" hd-pid="${id}" hd-price="${100 + i}" hd-regprice="${100 + i}">`).join('');

test('public prices reject missing, duplicate and personalized markup', () => {
  const html = fixture();
  assert.equal(Object.keys(prices.parsePrices(html)).length, 13);
  assert.throws(() => prices.parsePrices(html.slice(html.indexOf('>') + 1)), /Incomplete/);
  assert.throws(() => prices.parsePrices(html + html.slice(0, html.indexOf('>') + 1)), /Invalid/);
  assert.throws(() => prices.parsePrices(html.replace('hd-price="100"', 'hd-price="99"')), /Non-public/);
});
test('prices render in the initial HTML with the staging unit', () => {
  const html = prices.renderPrices(fs.readFileSync('index.html', 'utf8'), { checkedAt: new Date().toISOString(), prices: prices.parsePrices(fixture()) });
  assert.equal((html.match(/See checkout/g) || []).length, 0);
  assert.match(html, /\$111 \/ room/);
  assert.equal((html.match(/data-hd-price=/g) || []).length, 13);
});
test('a refresh outage keeps recently verified HTML prices, then expires them', async () => {
  let now = Date.now(); let refresh; let requests = 0;
  const field = { dataset: { hdPrice: '449299', priceCheckedAt: new Date(now).toISOString() }, textContent: '$123', replaceChildren(link) { this.textContent = link.textContent; } };
  const doc = { hidden: false, querySelectorAll: () => [field], createElement: () => ({}), addEventListener: () => {} };
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(fs.readFileSync('pricing.js', 'utf8'), { document: doc, Date: Clock, Intl, AbortSignal, fetch: async () => { requests++; throw Error('Temporarily offline'); }, setInterval: callback => { refresh = callback; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 0); assert.equal(field.textContent, '$123');
  now += 360000; refresh(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1); assert.equal(field.textContent, '$123');
  now += 300000; refresh(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(field.textContent, 'See checkout');
});
test('save failure cannot become a successful acknowledgement', async () => {
  const storage = new MemoryStore();
  storage.create = async () => { throw Error('Storage unavailable'); };
  await assert.rejects(inquiries.save(sample(), inquiries.newId(), storage), /Storage unavailable/);
});
test('failed SMTP retains the full private inquiry and pending marker', async () => {
  const storage = new MemoryStore();
  const record = await inquiries.save(sample(), inquiries.newId(), storage);
  let savedBeforeSend = false;
  const failed = await inquiries.deliver(record.id, { storage, send: async () => {
    savedBeforeSend = Boolean(await storage.read(inquiries.recordPath(record.id)));
    const error = Error('Offline'); error.code = 'ECONNECTION'; throw error;
  } });
  assert.ok(savedBeforeSend);
  assert.equal(failed.status, 'failed');
  assert.equal((await storage.read(inquiries.recordPath(record.id))).value.fields.message, sample().message);
  assert.ok(await storage.read(inquiries.queuePath(record.id)));
});
test('a resend with the same request ID sends once and cannot change the saved content', async () => {
  const storage = new MemoryStore(); const id = inquiries.newId(); let sent = 0;
  const send = async () => { sent++; return { messageId: 'test-message' }; };
  await inquiries.save(sample(), id, storage);
  await inquiries.deliver(id, { storage, send });
  await inquiries.save(sample(), id, storage);
  await inquiries.deliver(id, { storage, send });
  assert.equal(sent, 1);
  assert.equal(await storage.read(inquiries.queuePath(id)), null);
  await assert.rejects(inquiries.save({ ...sample(), message: 'Different' }, id, storage), /request-conflict/);
});
test('concurrent delivery requests claim one send', async () => {
  const storage = new MemoryStore(); const id = inquiries.newId(); let sent = 0;
  await inquiries.save(sample(), id, storage);
  await Promise.all([1, 2].map(() => inquiries.deliver(id, { storage, send: async () => { sent++; return { messageId: 'test' }; } })));
  assert.equal(sent, 1);
});
test('ambiguous SMTP timeout waits for a staff check before retrying', async () => {
  const storage = new MemoryStore(); const id = inquiries.newId(); let sent = 0;
  await inquiries.save(sample(), id, storage);
  const send = async () => { sent++; const error = Error('Timed out after DATA'); error.code = 'ETIMEDOUT'; throw error; };
  await inquiries.deliver(id, { storage, send });
  const result = await inquiries.deliver(id, { storage, send, now: Date.now() + 86400000 });
  assert.equal(result.status, 'uncertain'); assert.equal(sent, 1);
  await inquiries.deliver(id, { storage, confirmedRetry: true, send: async () => { sent++; return {}; } });
  assert.equal(sent, 2);
});
test('hourly submission limit is durable and shared between requests', async () => {
  const storage = new MemoryStore(); const now = Date.now();
  for (let i = 0; i < 8; i++) assert.equal(await inquiries.allowed('test-ip', storage, now), true);
  assert.equal(await inquiries.allowed('test-ip', storage, now), false);
  assert.equal(await inquiries.allowed('test-ip', storage, now + 3600000), true);
});
test('health detects a delayed inquiry behind a leftover delivered marker', async () => {
  const storage = new MemoryStore();
  const first = await inquiries.save(sample(), inquiries.newId(), storage);
  await storage.write(inquiries.recordPath(first.id), { ...first, status: 'sent' }, (await storage.read(inquiries.recordPath(first.id))).etag);
  const second = await inquiries.save(sample(), inquiries.newId(), storage);
  await storage.write(inquiries.recordPath(second.id), { ...second, createdAt: new Date(Date.now() - 180000).toISOString() }, (await storage.read(inquiries.recordPath(second.id))).etag);
  assert.equal((await inquiries.health(storage)).delayed, true);
  await storage.remove(inquiries.recordPath(second.id));
  await assert.rejects(inquiries.health(storage), /Saved inquiry unavailable/);
});
test('feedback triage prioritizes concerns and leaves uncertain replies for a person', () => {
  assert.equal(feedback.classify('They look great!'), 'positive');
  assert.equal(feedback.classify('Great service but the kitchen is too dark'), 'concern');
  assert.equal(feedback.classify('I am not happy'), 'concern');
  assert.equal(feedback.classify('Thanks'), 'follow-up');
  assert.equal(feedback.classify('STOP'), 'stop');
  for (const kind of ['positive', 'concern', 'follow-up']) assert.ok(feedback.messageFor(kind).includes(feedback.REVIEW_URL));
});
test('known text reply is saved, routed once and deduplicated', async () => {
  const storage = new MemoryStore(); let alerts = 0;
  await feedback.registerContact({ name: 'Test Agent', phone: '+15005550006', orderId: 'TEST-ONLY', consentedAt: new Date().toISOString() }, storage);
  const params = { MessageSid: 'SM' + '1'.repeat(32), From: '+15005550006', To: '+15005550007', Body: 'There is a problem with the photos' };
  const deps = { storage, save: async () => { alerts++; }, deliver: async () => {} };
  assert.match(await feedback.handle(params, deps), /Our photographer will follow up/);
  assert.doesNotMatch(await feedback.handle(params, deps), /<Message>/);
  assert.equal(alerts, 1);
});
test('unknown number gets no review request; STOP suppresses subsequent replies', async () => {
  const storage = new MemoryStore(); const deps = { storage, save: async () => {}, deliver: async () => {} };
  const base = { From: '+15005550006', To: '+15005550007', Body: 'Great photos' };
  assert.doesNotMatch(await feedback.handle({ ...base, MessageSid: 'SM' + '2'.repeat(32) }, deps), /<Message>/);
  await feedback.registerContact({ name: 'Test', phone: base.From, orderId: 'TEST', consentedAt: new Date().toISOString() }, storage);
  await feedback.handle({ ...base, MessageSid: 'SM' + '3'.repeat(32), Body: 'STOP' }, deps);
  assert.doesNotMatch(await feedback.handle({ ...base, MessageSid: 'SM' + '4'.repeat(32) }, deps), /<Message>/);
});
test('staff inbox rejects anonymous access and escapes visitor HTML', async () => {
  const inbox = require('../api/inquiries');
  let status;
  const res = { setHeader() {}, status(code) { status = code; return this; }, end() {} };
  await inbox({ method: 'GET', headers: {} }, res);
  assert.equal(status, 401);
  const html = inbox.page([{ id: inquiries.newId(), createdAt: new Date().toISOString(), status: 'queued', fields: { ...sample(), message: '<script>alert(1)</script>' } }]);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('SMS endpoint stays off without a connected provider and rejects forged requests', async () => {
  const handler = require('../api/sms-reply'); let status;
  const res = { setHeader() {}, status(code) { status = code; return this; }, end() {} };
  await handler({ method: 'POST', headers: {} }, res); assert.equal(status, 503);
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { SMS_FEEDBACK_ENABLED: 'true', TWILIO_AUTH_TOKEN: 'TEST-ONLY-FAKE', TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), SMS_REPLY_WEBHOOK_URL: 'https://www.listingpixl.com/api/sms-reply' });
    await handler({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'forged' }, body: { Body: 'Great' } }, res);
    assert.equal(status, 403);
  } finally { for (const key of ['SMS_FEEDBACK_ENABLED', 'TWILIO_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID', 'SMS_REPLY_WEBHOOK_URL']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
});
