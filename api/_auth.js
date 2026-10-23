// The existing team credentials protect browser sessions and Basic API access.
// No password is copied into HTML or client-side storage.
const crypto = require('node:crypto');
const { getIronSession } = require('iron-session');
const store = require('../lib/private-store');

const SESSION_SECONDS = 4 * 60 * 60;
const digest = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const user = () => process.env.STAFF_USER || 'team';

function basicAuthorized(req) {
  const password = process.env.STAFF_PASSWORD;
  if (!password) return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(req.headers.authorization || '');
  if (!m || m[1].length > 4096) return false;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // Check both so the time taken doesn't reveal which one was wrong
  const userOk = same(decoded.slice(0, i), user());
  const passOk = same(decoded.slice(i + 1), password);
  return userOk && passOk;
}

let seedPromise;
async function sessionSeed() {
  if (!seedPromise) {
    seedPromise = store.create('auth/session-key.json', { key: crypto.randomBytes(32).toString('hex') }).then(result => {
      if (!/^[a-f0-9]{64}$/.test(result.value?.key || '')) throw Error('Private session key unavailable');
      return result.value.key;
    }).catch(error => { seedPromise = undefined; throw error; });
  }
  return seedPromise;
}

async function sessionOptions() {
  if (!process.env.STAFF_PASSWORD) throw Error('Team login is not configured');
  return {
    cookieName: '__Host-listingpixl-team',
    // A random server-only key prevents public pre-login cookies from becoming
    // an offline password-guessing oracle. Credential rotation still revokes them.
    password: crypto.createHmac('sha256', await sessionSeed()).update('Listing Pixl team session v1:' + user() + ':' + process.env.STAFF_PASSWORD).digest('hex'),
    ttl: SESSION_SECONDS,
    cookieOptions: { secure: true, httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS },
  };
}
const session = async (req, res) => getIronSession(req, res, await sessionOptions());

async function authorized(req, res) {
  if (!process.env.STAFF_PASSWORD) return false;
  if (basicAuthorized(req)) return true;
  if (!String(req.headers.cookie || '').includes('__Host-listingpixl-team=')) return false;
  try {
    const current = await session(req, res);
    return current.user === user() && Number.isSafeInteger(current.expiresAt) && current.expiresAt > Date.now();
  } catch { return false; }
}

function safeNext(value) {
  if (typeof value !== 'string' || value.length > 1200 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/staff';
  try {
    const url = new URL(value, 'https://staff.invalid');
    if (url.origin !== 'https://staff.invalid' || !/^\/staff(?:\/inquiries)?\/?$/.test(url.pathname)) return '/staff';
    const cursor = url.searchParams.get('cursor');
    return url.pathname + (cursor ? '?cursor=' + encodeURIComponent(cursor.slice(0, 1000)) : '');
  } catch { return '/staff'; }
}

async function requireStaff(req, res, next = '/staff') {
  if (await authorized(req, res)) return true;
  if (req.method === 'GET' && String(req.headers.accept || '').includes('text/html')) {
    res.statusCode = 303;
    res.setHeader('Location', '/staff/login?next=' + encodeURIComponent(safeNext(next)));
  } else {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
  }
  res.end('Team sign-in required.');
  return false;
}

function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    return origin.protocol === 'https:' && origin.host === req.headers.host && req.headers['sec-fetch-site'] !== 'cross-site';
  } catch { return false; }
}

module.exports = { SESSION_SECONDS, same, user, session, sessionOptions, basicAuthorized, authorized, requireStaff, safeNext, sameOrigin };

