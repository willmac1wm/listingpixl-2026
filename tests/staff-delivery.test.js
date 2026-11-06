const { test } = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../lib/delivery');
const handler = require('../api/staff-delivery');
const gallery = require('../api/gallery');
const store = require('../lib/private-store');

const headers = extra => ({ host: 'www.listingpixl.com', ...extra });
function response() {
  const saved = new Map();
  return { statusCode: 200, headersSent: false, body: '',
    setHeader(key, value) { saved.set(key.toLowerCase(), value); },
    getHeader(key) { return saved.get(key.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}
const basic = () => 'Basic ' + Buffer.from('team:LOCAL-TEST-ONLY-not-an-account-password').toString('base64');

function memoryStore() {
  const objects = new Map();
  const original = { create: store.create, read: store.read, write: store.write, list: store.list, remove: store.remove };
  store.create = async (path, value) => { const created = !objects.has(path); if (created) objects.set(path, { value, etag: 'e1' }); return { value: objects.get(path).value, etag: 'e1', created }; };
  store.read = async path => objects.has(path) ? { value: objects.get(path).value, etag: 'e1' } : null;
  store.write = async (path, value) => { objects.set(path, { value, etag: 'e2' }); return { value, etag: 'e2' }; };
  store.list = async prefix => ({ items: [...objects.keys()].filter(k => k.startsWith(prefix)).map(path => ({ path, uploadedAt: new Date().toISOString() })), cursor: null });
  store.remove = async path => { objects.delete(path); };
  return () => Object.assign(store, original);
}

test('shoot slug comes from the address, and a new shoot gets a token and 30-day expiry', () => {
  assert.equal(delivery.slugFor('114 E Anna St', 'Whitesboro'), '114-e-anna-st-whitesboro-nj');
  const s = delivery.newShoot({ address: '114 E Anna St', city: 'Whitesboro', agentName: 'Jason Ruffenach', package: 'Marketing', hdphSiteId: '3531912' });
  assert.equal(s.slug, '114-e-anna-st-whitesboro-nj');
  assert.equal(s.status, 'shot');
  assert.match(s.galleryToken, /^[a-f0-9]{64}$/);
  assert.equal(s.galleryExpiresAt.slice(0, 10), new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10));
  assert.equal(s.stripePaymentLink, '');
});

test('delivery drafts are the Recipe Pack wording with the shoot filled in', () => {
  const d = delivery.deliveryDrafts({ address: '114 E Anna St', agentName: 'Jason', photoCount: 45, galleryUrl: 'https://example.test/gallery/abc' });
  assert.match(d.text, /Hi Jason, your photos for 114 E Anna St are ready — 45 photos/);
  assert.match(d.emailBody, /Virtually Staged \/ Virtually Landscaped are digital renderings/);
  assert.match(d.followUp, /checking the photos for 114 E Anna St all uploaded okay/);
  assert.match(d.reviewAsk, /Google review for Listing Pixl/);
});

test('only real Stripe Payment Links are accepted; other checkout URLs are rejected', () => {
  const s = delivery.newShoot({ address: '1 Main St', city: 'Villas' });
  assert.throws(() => delivery.applyShootEdits(s, { stripePaymentLink: 'https://evil.example/pay' }), /Stripe Payment Link/);
  const ok = delivery.applyShootEdits(s, { stripePaymentLink: 'https://buy.stripe.com/abc123' });
  assert.equal(ok.stripePaymentLink, 'https://buy.stripe.com/abc123');
});

test('tour links embed only from allowlisted hosts; anything else is a plain link, never an iframe', () => {
  assert.equal(delivery.embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(delivery.embedUrl('https://my.matterport.com/show/?m=abc'), 'https://my.matterport.com/show/?m=abc');
  assert.equal(delivery.embedUrl('https://evil.example/tour'), null);
  assert.equal(delivery.embedUrl('javascript:alert(1)'), null);
  assert.equal(delivery.embedUrl('not a url'), null);
});

test('delivery CRM needs team login; create → save → gallery token flow works', async () => {
  const restoreStore = memoryStore();
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const anon = response();
    await handler({ method: 'GET', url: '/staff/delivery?action=shoots', headers: headers() }, anon);
    assert.equal(anon.statusCode, 401);

    const auth = { authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' };
    const created = response();
    await handler({ method: 'POST', url: '/staff/delivery?action=createShoot', headers: headers(auth), body: JSON.stringify({ address: '114 E Anna St', city: 'Whitesboro', agentName: 'Jason Ruffenach', package: 'Marketing', hdphSiteId: '3531912' }) }, created);
    assert.equal(created.statusCode, 200);
    const shoot = JSON.parse(created.body);
    assert.equal(shoot.slug, '114-e-anna-st-whitesboro-nj');
    assert.match(shoot.galleryUrl, /\/gallery\/[a-f0-9]{64}$/);
    assert.match(shoot.drafts.text, /Hi Jason Ruffenach/);

    const saved = response();
    await handler({ method: 'POST', url: '/staff/delivery?action=saveShoot', headers: headers(auth), body: JSON.stringify({ slug: shoot.slug, status: 'ready', stripePaymentLink: 'https://buy.stripe.com/test123', tours: { matterport: 'https://my.matterport.com/show/?m=abc' }, drafts: { ...shoot.drafts, followUp: 'Edited follow-up draft.' } }) }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(JSON.parse(saved.body).status, 'ready');
    assert.equal(JSON.parse(saved.body).drafts.followUp, 'Edited follow-up draft.');
  } finally {
    restoreStore();
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});

test('client gallery: unknown token 404, expired token 410, valid token shows photos and embeds', async () => {
  const restoreStore = memoryStore();
  try {
    const shoot = delivery.newShoot({ address: '114 E Anna St', city: 'Whitesboro', agentName: 'Jason' });
    shoot.files.edited = [{ filename: '114-E-Anna-St-01-Front-Exterior-Virtually-Landscaped.jpg', url: 'https://example.test/photo.jpg' }];
    shoot.tours.youtube = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await store.create('delivery/shoots/' + shoot.slug + '.json', shoot);

    const bad = response();
    await gallery({ method: 'GET', url: '/gallery/0000', query: { token: '0000' }, headers: headers() }, bad);
    assert.equal(bad.statusCode, 404);

    const good = response();
    await gallery({ method: 'GET', url: '/gallery/' + shoot.galleryToken, query: { token: shoot.galleryToken }, headers: headers() }, good);
    assert.equal(good.statusCode, 200);
    assert.match(good.body, /114 E Anna St/);
    assert.match(good.body, /Virtually-Landscaped\.jpg/);
    assert.match(good.body, /youtube\.com\/embed\/dQw4w9WgXcQ/);
    assert.doesNotMatch(good.body, /draft/i); // drafts never leak to the client gallery

    const expired = { ...shoot, galleryToken: delivery.newGalleryToken(), galleryExpiresAt: new Date(Date.now() - 1000).toISOString() };
    await store.create('delivery/shoots/expired-test-nj.json', expired);
    const gone = response();
    await gallery({ method: 'GET', url: '/gallery/' + expired.galleryToken, query: { token: expired.galleryToken }, headers: headers() }, gone);
    assert.equal(gone.statusCode, 410);
  } finally { restoreStore(); }
});
