// Delivery-service / mini-CRM API for /staff. Same team login as /staff;
// writes need the X-Staff header (see api/shoots.js).
//
// What this is: one record per shoot (client/agent, address, package,
// status, Stripe Payment Link, HD Photo Hub site id, tour/video URLs,
// gallery token + expiry, approved files, delivery drafts).
//
// What this is NOT: a sender. There is no send action anywhere in this
// codebase. Drafts are edited and copied by hand; William approves the
// exact final text in chat before anything goes out in his name.
// HD Photo Hub stays the fallback for ordering / pricing / checkout.
const { authorized } = require('./_auth');
const store = require('../lib/private-store');
const delivery = require('../lib/delivery');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function shootPath(slug) {
  if (!delivery.SLUG.test(slug || '')) throw new HttpError(400, 'Bad shoot slug.');
  return `delivery/shoots/${slug}.json`;
}

async function readShoot(slug) {
  const rec = await store.read(shootPath(slug)).catch(() => null);
  if (!rec) throw new HttpError(404, 'That shoot is not in the delivery CRM yet.');
  return rec;
}

function present(req, shoot) {
  const drafts = shoot.drafts || delivery.deliveryDrafts({ ...shoot, galleryUrl: delivery.galleryUrlFor(req, shoot) });
  return { ...shoot, galleryUrl: delivery.galleryUrlFor(req, shoot), drafts, expired: delivery.galleryExpired(shoot) };
}

const actions = {
  async shoots(req) {
    const list = await store.list('delivery/shoots/', { limit: 50 }).catch(() => ({ items: [] }));
    const out = [];
    for (const item of list.items) {
      const rec = await store.read(item.path).catch(() => null);
      if (rec) out.push(present(req, rec.value));
    }
    return out.sort((a, b) => String(b.shotDate).localeCompare(String(a.shotDate)));
  },

  async shoot(req, body) { return present(req, (await readShoot(String(body.slug || ''))).value); },

  async createShoot(req, body) {
    let shoot;
    try { shoot = delivery.newShoot(body); } catch (e) { throw new HttpError(400, e.message); }
    const existing = await store.read(shootPath(shoot.slug)).catch(() => null);
    if (existing) throw new HttpError(409, 'A shoot with that address already exists in the delivery CRM.');
    await store.create(shootPath(shoot.slug), shoot);
    return present(req, shoot);
  },

  async saveShoot(req, body) {
    const rec = await readShoot(String(body.slug || ''));
    let next;
    try { next = delivery.applyShootEdits(rec.value, body); } catch (e) { throw new HttpError(400, e.message); }
    await store.write(shootPath(next.slug), next, rec.etag);
    return present(req, next);
  },

  async regenerateToken(req, body) {
    const rec = await readShoot(String(body.slug || ''));
    const next = { ...rec.value, galleryToken: delivery.newGalleryToken(), galleryExpiresAt: delivery.galleryExpiry(), updatedAt: new Date().toISOString() };
    await store.write(shootPath(next.slug), next, rec.etag);
    return present(req, next);
  },

  async addFile(req, body) {
    // Record an approved edited file (already stored in public Blob by the
    // Recipe Studio approve step) on the shoot, for the gallery + MLS export.
    const rec = await readShoot(String(body.slug || ''));
    const url = String(body.url || '');
    const filename = String(body.filename || '');
    if (!/^https:\/\//.test(url) || !filename) throw new HttpError(400, 'Need a file URL and filename.');
    const next = { ...rec.value, updatedAt: new Date().toISOString(), files: { ...rec.value.files, edited: [...(rec.value.files?.edited || []), { filename, url, addedAt: new Date().toISOString() }] } };
    await store.write(shootPath(next.slug), next, rec.etag);
    return present(req, next);
  },
};

const POSTS = new Set(['createShoot', 'saveShoot', 'regenerateToken', 'addFile']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (!await authorized(req, res)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
    return send(401, { error: 'Team login required.' });
  }
  const action = new URL(req.url, 'http://x').searchParams.get('action');
  const isPost = POSTS.has(action);
  if (!actions[action] || (isPost !== (req.method === 'POST'))) return send(400, { error: 'Unknown action.' });
  if (isPost && req.headers['x-staff'] !== '1') return send(403, { error: 'Missing X-Staff header.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    send(200, await actions[action](req, body || {}));
  } catch (e) {
    send(e.status || 500, { error: e.message });
  }
};
module.exports._actions = actions;
