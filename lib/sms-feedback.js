const { createHash } = require('node:crypto');
const twilio = require('twilio');
const store = require('./private-store');
const inquiries = require('./inquiries');
const REVIEW_URL = require('../config/business-links.json').googleReview;
const phoneKey = phone => createHash('sha256').update(phone).digest('hex');

function classify(text) {
  const value = text.toLowerCase().trim();
  if (/^(stop|stopall|unsubscribe|cancel|end|quit|revoke|opt ?out)\b/.test(value)) return 'stop';
  if (/^(start|unstop)\s*[.!]?$/i.test(value)) return 'start';
  // Mixed feedback and negation must reach a person, even if it also says "great".
  if (/\b(help|bad|poor|problem|issue|missing|blurry|dark|late|unhappy|disappoint\w*|wrong|fix|not|never|don't|didn't|isn't|aren't|wasn't|could be better|concern\w*)\b/.test(value)) return 'concern';
  if (/\b(good|great|excellent|amazing|perfect|love|loved|happy|fantastic|awesome)\b/.test(value)) return 'positive';
  return 'follow-up';
}
function messageFor(kind) {
  if (kind === 'positive') return 'Glad to hear it! Thanks for choosing Listing Pixl. You can share your honest experience here: ' + REVIEW_URL;
  if (kind === 'concern') return 'Thanks for telling us. Our photographer will follow up to help. Please reply with what needs attention and the property address. You can also share an honest review here: ' + REVIEW_URL;
  return 'Thanks for your feedback. Our photographer will follow up. Call or text (609) 780-7027 if you need help. Honest reviews are welcome: ' + REVIEW_URL;
}
function xml(message) {
  const response = new twilio.twiml.MessagingResponse();
  if (message) response.message(message);
  return response.toString();
}

async function handle(params, { storage = store, save = inquiries.save, deliver = inquiries.deliver } = {}) {
  const sid = params.MessageSid;
  const kind = params.OptOutType === 'STOP' ? 'stop' : params.OptOutType === 'START' ? 'start' : classify(params.Body);
  const contactPath = 'feedback/contacts/' + phoneKey(params.From) + '.json';
  if (kind === 'stop' || kind === 'start') {
    const current = await storage.read(contactPath);
    const value = { ...(current?.value || { phone: params.From }), optedOut: kind === 'stop', updatedAt: new Date().toISOString() };
    if (current) await storage.write(contactPath, value, current.etag); else await storage.create(contactPath, value);
    return xml(); // Twilio's own opt-out service sends its standard confirmation.
  }
  const contact = await storage.read(contactPath);
  const known = Boolean(contact?.value.consentedAt && !contact.value.optedOut);
  const saved = await storage.create('feedback/replies/' + sid + '.json', {
    sid, from: params.From, to: params.To, body: params.Body, kind, known,
    receivedAt: new Date().toISOString(), inquiryId: inquiries.newId(), status: 'received',
  });
  if (saved.value.status === 'processed') return xml();
  const record = saved.value;
  // Every reply is privately retained and placed in the existing recoverable inbox.
  // Unrecognized numbers receive no automated review request.
  await save(inquiries.fields({
    name: contact?.value.name || 'SMS feedback', email: 'ListingPixl.Media@gmail.com', phone: params.From,
    message: '[' + kind.toUpperCase() + '] Text feedback\n' + params.Body + '\n\nMessage reference: ' + sid + (contact?.value.orderId ? '\nOrder: ' + contact.value.orderId : ''),
  }), record.inquiryId);
  await deliver(record.inquiryId);
  try { await storage.write('feedback/replies/' + sid + '.json', { ...record, status: 'processed' }, saved.etag); }
  catch (error) { if (store.isConflict(error)) return xml(); throw error; }
  return xml(known ? messageFor(kind) : '');
}

// Called only by a verified delivery integration after a client has consented.
// HDPhotoHub does not currently expose a suitable incoming-SMS webhook, so
// do not enable this adapter until a two-way provider is connected.
async function registerContact({ name, phone, orderId, consentedAt }, storage = store) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !name || !orderId || !Number.isFinite(Date.parse(consentedAt))) throw Error('Verified client and SMS consent required');
  const path = 'feedback/contacts/' + phoneKey(phone) + '.json';
  const current = await storage.read(path);
  const value = { name: String(name).slice(0, 100), phone, orderId: String(orderId).slice(0, 80), consentedAt, optedOut: current?.value.optedOut || false };
  return current ? storage.write(path, value, current.etag) : storage.create(path, value);
}
module.exports = { REVIEW_URL, classify, messageFor, xml, handle, registerContact };
