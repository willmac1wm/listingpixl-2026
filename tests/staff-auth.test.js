const { test } = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../api/_auth');
const handler = require('../api/staff-auth');
const store = require('../lib/private-store');
const inquiries = require('../lib/inquiries');
const inbox = require('../api/inquiries');

const origin = 'https://www.listingpixl.com';
const headers = extra => ({ host: 'www.listingpixl.com', ...extra });
function response() {
  const saved = new Map();
  return { statusCode: 200, headersSent: false, body: '',
    setHeader(key, value) { saved.set(key.toLowerCase(), value); },
    getHeader(key) { return saved.get(key.toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    end(value = '') { this.body = value; },
  };
}
const cookie = res => String([res.getHeader('set-cookie')].flat().filter(Boolean).at(-1) || '').split(';')[0];
const csrf = res => /name="csrf" value="([a-f0-9]+)"/.exec(res.body)?.[1];
const withPassword = async fn => {
  const old = process.env.STAFF_PASSWORD;
  const oldCreate = store.create;
  const objects = new Map();
  store.create = async (path, value) => {
    const created = !objects.has(path);
    if (created) objects.set(path, value);
    return { value: objects.get(path), created };
  };
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try { await fn(); } finally { store.create = oldCreate; if (old === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = old; }
};

test('browser visitors reach sign-in while anonymous API access remains denied', () => withPassword(async () => {
  const browser = response();
  await inbox({ method: 'GET', headers: headers({ accept: 'text/html' }) }, browser);
  assert.equal(browser.statusCode, 303);
  assert.equal(browser.getHeader('location'), '/staff/login?next=%2Fstaff%2Finquiries');
  assert.equal(browser.getHeader('www-authenticate'), undefined);
  const api = response();
  await inbox({ method: 'GET', headers: headers() }, api);
  assert.equal(api.statusCode, 401);
  assert.doesNotMatch(api.body, /saved questions|Property:/i);
}));

test('sign-in opens the saved inbox, then logout clears the encrypted session', () => withPassword(async () => {
  const original = { create: store.create, list: store.list, read: store.read };
  const id = inquiries.newId();
  try {
    const login = response();
    await handler({ method: 'GET', url: '/staff/login?next=%2Fstaff%2Finquiries', headers: headers() }, login);
    assert.equal(login.statusCode, 200);
    assert.match(login.getHeader('set-cookie').toString(), /Secure/);
    assert.match(login.getHeader('set-cookie').toString(), /HttpOnly/);
    assert.match(login.getHeader('set-cookie').toString(), /SameSite=Strict/i);
    assert.ok(csrf(login));
    assert.ok(!login.body.includes(process.env.STAFF_PASSWORD));
    const signedIn = response();
    await handler({ method: 'POST', url: '/staff/login', headers: headers({ cookie: cookie(login), origin, 'content-type': 'application/x-www-form-urlencoded' }), body: { csrf: csrf(login), next: '/staff/inquiries', username: 'team', password: process.env.STAFF_PASSWORD } }, signedIn);
    assert.equal(signedIn.statusCode, 303);
    assert.equal(signedIn.getHeader('location'), '/staff/inquiries');
    assert.ok(!cookie(signedIn).includes(process.env.STAFF_PASSWORD));
    store.list = async prefix => ({ items: prefix === 'inquiries/records/' ? [{ path: inquiries.recordPath(id) }] : [], cursor: null });
    store.read = async () => ({ value: { id, createdAt: new Date().toISOString(), status: 'sent', sentAt: new Date().toISOString(), fields: inquiries.fields({ name: 'Internal Test', email: 'test@example.com', message: 'SAVED-INQUIRY-CHECK' }) } });
    const savedInbox = response();
    await inbox({ method: 'GET', headers: headers({ accept: 'text/html', cookie: cookie(signedIn) }) }, savedInbox);
    assert.equal(savedInbox.statusCode, 200);
    assert.match(savedInbox.body, /SAVED-INQUIRY-CHECK/);
    assert.equal(savedInbox.getHeader('cache-control'), 'private, no-store');
    const logout = response();
    await handler({ method: 'GET', url: '/staff/logout', headers: headers({ cookie: cookie(signedIn) }) }, logout);
    const signedOut = response();
    await handler({ method: 'POST', url: '/staff/logout', headers: headers({ cookie: cookie(signedIn), origin, 'content-type': 'application/x-www-form-urlencoded' }), body: { csrf: csrf(logout) } }, signedOut);
    assert.equal(signedOut.statusCode, 303);
    assert.match(signedOut.getHeader('set-cookie').toString(), /Max-Age=0/);
    assert.equal(await auth.authorized({ headers: headers({ cookie: cookie(signedOut) }) }, response()), false);
  } finally { Object.assign(store, original); }
}));

test('forged, expired and rotated sessions do not authorize; Basic access still works', () => withPassword(async () => {
  const res = response();
  const current = await auth.session({ headers: headers() }, res);
  current.user = 'team'; current.expiresAt = Date.now() + 60000; await current.save();
  const req = { headers: headers({ cookie: cookie(res) }) };
  assert.equal(await auth.authorized(req, response()), true);
  assert.equal(await auth.authorized({ headers: headers({ cookie: '__Host-listingpixl-team=forged' }) }, response()), false);
  current.expiresAt = Date.now() - 1; await current.save();
  assert.equal(await auth.authorized({ headers: headers({ cookie: cookie(res) }) }, response()), false);
  process.env.STAFF_PASSWORD += '-rotated';
  assert.equal(await auth.authorized(req, response()), false);
  assert.equal(await auth.authorized({ headers: headers({ authorization: 'Basic ' + Buffer.from('team:' + process.env.STAFF_PASSWORD).toString('base64') }) }, response()), true);
}));

test('login rejects cross-site posts, missing CSRF and unsafe redirect destinations', () => withPassword(async () => {
  for (const next of ['https://example.com/', '//example.com/', '/\\example.com', '/api/shoots?action=approve', '/staff/../api/shoots']) assert.equal(auth.safeNext(next), '/staff');
  assert.equal(auth.safeNext('/staff/inquiries?cursor=abc'), '/staff/inquiries?cursor=abc');
  const login = response();
  await handler({ method: 'GET', url: '/staff/login', headers: headers() }, login);
  for (const bad of [{ origin: 'https://example.com', csrf: csrf(login) }, { origin, csrf: 'forged' }]) {
    const res = response();
    await handler({ method: 'POST', url: '/staff/login', headers: headers({ cookie: cookie(login), origin: bad.origin, 'content-type': 'application/x-www-form-urlencoded' }), body: { csrf: bad.csrf, username: 'team', password: process.env.STAFF_PASSWORD } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.getHeader('location'), undefined);
  }
}));

test('sign-in throttle is shared and never stores an IP or password', () => withPassword(async () => {
  const saved = new Map();
  const storage = { async create(path, value) { if (saved.has(path)) return { created: false }; saved.set(path, value); return { created: true }; } };
  const req = { headers: headers({ 'x-vercel-forwarded-for': '192.0.2.10' }) };
  const results = await Promise.all(Array.from({ length: 12 }, () => handler.allowed(req, storage, 3600000)));
  assert.equal(results.filter(Boolean).length, 10);
  assert.ok(!JSON.stringify([...saved]).includes('192.0.2.10'));
  assert.ok(!JSON.stringify([...saved]).includes(process.env.STAFF_PASSWORD));
}));
