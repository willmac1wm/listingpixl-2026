const { createHmac, timingSafeEqual } = require('node:crypto');
const { authorized } = require('./_auth');
const store = require('../lib/private-store');
const inquiries = require('../lib/inquiries');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csrf = id => createHmac('sha256', process.env.STAFF_PASSWORD || '').update('inquiry-action:' + id).digest('hex');
function validCsrf(id, value) {
  const expected = Buffer.from(csrf(id));
  const actual = Buffer.from(String(value || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function card(record) {
  const f = record.fields;
  const uncertain = record.status === 'uncertain' || record.status === 'sending';
  const pending = record.status !== 'sent';
  return `<article class="lead"><div class="lead-top"><h2>${esc(f.name)}</h2><span class="badge ${record.status === 'sent' ? 'sent' : 'pending'}">${esc(record.status)}</span></div>
    <p class="meta">${esc(new Date(record.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' }))} Eastern · ${esc(record.id)}</p>
    <p><a href="mailto:${esc(f.email)}">${esc(f.email)}</a>${f.phone ? ' · ' + esc(f.phone) : ''}</p>
    ${f.address ? '<p><strong>Property:</strong> ' + esc(f.address) + '</p>' : ''}
    ${f.package ? '<p><strong>Package:</strong> ' + esc(f.package) + '</p>' : ''}
    ${f.date ? '<p><strong>Preferred date:</strong> ' + esc(f.date) + '</p>' : ''}
    <p class="message">${esc(f.message)}</p>
    ${pending ? `<p class="notice">${uncertain ? 'Delivery is uncertain. Search Gmail for this reference before resending; Gmail may already have accepted it.' : 'Your private copy is safe. Email delivery still needs attention.'}</p>
      <form method="post" action="/staff/inquiries"><input type="hidden" name="id" value="${esc(record.id)}"><input type="hidden" name="csrf" value="${csrf(record.id)}">
        ${uncertain ? '<label class="check"><input type="checkbox" name="confirmedRetry" value="yes"> I checked Gmail and this email was not received.</label>' : ''}
        <button name="action" value="retry">Retry email delivery</button>
        <button name="action" value="mark-sent" class="secondary">Already received in Gmail</button>
      </form>` : '<p class="meta">Email sent ' + esc(new Date(record.sentAt).toLocaleString('en-US', { timeZone: 'America/New_York' })) + ' Eastern.</p>'}
    </article>`;
}
function page(records, cursor, message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Inquiry inbox | Listing Pixl</title><link rel="icon" href="/favicon.svg"><style>
  *{box-sizing:border-box}body{margin:0;background:#080e1a;color:#edf6ff;font:16px/1.6 Arial,sans-serif}main{max-width:940px;margin:auto;padding:32px 20px 70px}a{color:#58e6f2}header{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}h1{font-size:30px;margin:15px 0 8px}h2{font-size:21px;margin:0}.intro,.meta{color:#b4c5d5}.meta{font-size:13px;overflow-wrap:anywhere}.lead{background:#101e30;border:1px solid #29475c;border-radius:14px;margin:20px 0;padding:22px}.lead-top{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}.badge{border-radius:20px;padding:2px 12px;font-size:13px;text-transform:capitalize}.sent{color:#83f3d6;background:#123e3d}.pending{color:#ffd7e7;background:#58253c}.message{white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #2b4356;padding-top:16px}.notice{background:#30243a;border-left:3px solid #ef4b9a;padding:12px}.check{display:block;margin:14px 0}button,.button{border:0;border-radius:6px;background:#08d5e8;color:#06232b;padding:11px 16px;font:700 15px Arial,sans-serif;cursor:pointer;margin:5px 8px 5px 0}.secondary{background:#293f56;color:white}input[type=checkbox]{width:18px;height:18px;vertical-align:middle}.banner{padding:16px;border:1px solid #09b9cb;border-radius:8px}button:focus-visible,a:focus-visible{outline:3px solid #f655a1;outline-offset:3px}form{margin-top:14px}@media(max-width:500px){main{padding:20px 12px}.lead{padding:17px}button{width:100%}}
  </style></head><body><main><header><strong>LISTING <span style="color:#ed4091">PIXL</span></strong><a href="/staff">Team dashboard</a></header><h1>Inquiry inbox</h1><p class="intro">Every website inquiry is saved here before email delivery. Saved copies remain private. Pending emails can be recovered below.</p>${message ? '<p class="banner" role="status">' + esc(message) + '</p>' : ''}${records.length ? records.map(card).join('') : '<p>No inquiries in this view.</p>'}${cursor ? '<a class="button" href="/staff/inquiries?cursor=' + encodeURIComponent(cursor) + '">Next 50 saved inquiries</a>' : ''}</main></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!authorized(req)) { res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"'); return res.status(401).end('Team login required.'); }
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
      if (typeof body.id !== 'string' || !inquiries.ID.test(body.id) || !validCsrf(body.id, body.csrf)) return res.status(403).end('Refresh this inbox before trying again.');
      if (req.headers.origin && !inquiries.ORIGIN.test(req.headers.origin)) return res.status(403).end('Invalid origin.');
      if (body.action === 'mark-sent') {
        const current = await store.read(inquiries.recordPath(body.id));
        if (!current) return res.status(404).end('Inquiry not found.');
        await store.write(inquiries.recordPath(body.id), { ...current.value, status: 'sent', sentAt: new Date().toISOString(), verifiedByStaff: true }, current.etag);
        await store.remove(inquiries.queuePath(body.id)).catch(() => {});
      } else if (body.action === 'retry') {
        await inquiries.deliver(body.id, { confirmedRetry: body.confirmedRetry === 'yes' });
      } else return res.status(400).end('Unknown action.');
      res.setHeader('Location', '/staff/inquiries');
      return res.status(303).end();
    }
    const [saved, queue] = await Promise.all([
      store.list('inquiries/records/', { cursor: req.query?.cursor, limit: 50 }),
      store.list('inquiries/queue/', { limit: 50 }),
    ]);
    const ids = new Set(saved.items.map(item => item.path));
    const queued = await Promise.all(queue.items.map(async item => {
      const marker = await store.read(item.path);
      return marker ? inquiries.recordPath(marker.value.id) : null;
    }));
    queued.filter(Boolean).forEach(path => ids.add(path));
    const records = (await Promise.all([...ids].map(path => store.read(path)))).filter(Boolean).map(item => item.value);
    records.sort((a, b) => Number(a.status === 'sent') - Number(b.status === 'sent') || b.createdAt.localeCompare(a.createdAt));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).end(page(records, saved.cursor));
  } catch {
    console.error('INQUIRY_INBOX_UNAVAILABLE');
    return res.status(503).end('The private inbox is temporarily unavailable. Please try again.');
  }
};
module.exports.validCsrf = validCsrf;
module.exports.page = page;
