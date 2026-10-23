const { randomBytes, createHmac } = require('node:crypto');
const auth = require('./_auth');
const store = require('../lib/private-store');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ next = '/staff', csrf = '', error = '', logout = false, configured = true } = {}) {
  const retrySignIn = !configured && Boolean(process.env.STAFF_PASSWORD);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Team sign in | Listing Pixl</title><link rel="icon" href="/favicon.svg"><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px 18px;background:radial-gradient(ellipse at 15% 0%,#123d50 0,transparent 48%),radial-gradient(ellipse at 100% 100%,#352039 0,transparent 48%),#080e1a;color:#edf6ff;font:16px/1.6 Arial,sans-serif}.card{width:100%;max-width:460px;padding:34px;border:1px solid #29475c;border-radius:20px;background:#101e30;box-shadow:0 24px 70px #0005}.brand{display:inline-block;color:#edf6ff;text-decoration:none;font-weight:800;letter-spacing:.14em;font-size:20px}.brand span{color:#f35ca3}.eyebrow{color:#65e9f4;text-transform:uppercase;font-size:12px;font-weight:700;letter-spacing:.14em;margin:28px 0 4px}h1{font-size:30px;line-height:1.2;margin:0 0 14px}.intro,.note{color:#bbcddd}.intro{margin:0 0 24px}.note{font-size:13px;margin:20px 0 0}label{display:block;font-weight:700;margin:17px 0 6px}input{width:100%;padding:12px 14px;border:1px solid #47677e;border-radius:8px;background:#091522;color:#fff;font:inherit}button{width:100%;border:0;border-radius:8px;background:#47e3f0;color:#06232b;font:700 16px Arial,sans-serif;padding:14px;margin-top:24px;cursor:pointer;box-shadow:0 5px 20px #08d5e820}button:hover{background:#7af0f8}a{color:#65e9f4}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #f35ca3;outline-offset:3px}.error{padding:12px 14px;border:1px solid #a75e80;background:#3d2538;border-radius:8px;color:#ffe3ee}.back{display:block;text-align:center;margin-top:20px;font-size:14px}@media(max-width:420px){.card{padding:26px 22px}h1{font-size:27px}}
  </style></head><body><main class="card"><a class="brand" href="/" aria-label="Listing Pixl home">LISTING <span>PIXL</span></a><p class="eyebrow">Team access</p><h1>${logout ? 'Sign out' : 'Welcome back'}</h1><p class="intro">${logout ? 'End this team session on this browser.' : 'Sign in to open your dashboard and saved inquiries.'}</p>${error ? '<p class="error" role="alert">' + esc(error) + '</p>' : ''}${configured ? `<form method="post" action="${logout ? '/staff/logout' : '/staff/login'}"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="next" value="${esc(next)}">${logout ? '' : `<label for="username">Username</label><input id="username" name="username" autocomplete="username" value="${esc(auth.user())}" maxlength="100" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required>`}<button type="submit">${logout ? 'Sign out' : 'Sign in'}</button></form>` : ''}<p class="note">${logout ? 'Your saved inquiries stay private.' : 'Use your existing Listing Pixl team login. Team sessions expire after four hours.'}</p><a class="back" href="${logout ? '/staff' : retrySignIn ? '/staff/login?next=' + encodeURIComponent(auth.safeNext(next)) : '/'}">${logout ? 'Back to dashboard' : retrySignIn ? 'Return to sign in' : 'Back to website'}</a></main></body></html>`;
}

// Conditional-create slots share this limit across function instances. Raw IP
// addresses and credentials are not saved.
async function allowed(req, storage = store, now = Date.now()) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const key = createHmac('sha256', process.env.STAFF_PASSWORD || '').update(ip).digest('hex');
  const hour = Math.floor(now / 3600000);
  for (let i = 0; i < 10; i++) {
    const result = await storage.create(`auth/attempts/${hour}/${key}-${i}.json`, { at: now });
    if (result.created) return true;
  }
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const send = (code, options) => { res.statusCode = code; return res.end(page(options)); };
  const redirect = path => { res.statusCode = 303; res.setHeader('Location', path); return res.end(); };
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); res.statusCode = 405; return res.end(); }
  if (!process.env.STAFF_PASSWORD) return send(503, { configured: false, error: 'Team access needs setup. Please contact the website owner.' });
  const url = new URL(req.url, 'https://staff.invalid');
  const logout = /^\/staff\/logout\/?$/.test(url.pathname) || req.query?.mode === 'logout';
  try {
    const current = await auth.session(req, res);
    const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
    const next = auth.safeNext(req.method === 'POST' ? body.next : req.query?.next || url.searchParams.get('next'));
    if (req.method === 'GET') {
      if (!logout && await auth.authorized(req, res)) return redirect(next);
      if (!current.csrf) { current.csrf = randomBytes(32).toString('hex'); await current.save(); }
      return send(200, { next, csrf: current.csrf, logout });
    }
    if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type'] || '') || !auth.sameOrigin(req) || typeof body.csrf !== 'string' || !current.csrf || !auth.same(current.csrf, body.csrf)) return send(403, { configured: false, error: 'This sign-in page expired. Open Team sign in again and try once more.' });
    if (logout) { current.destroy(); return redirect('/staff/login'); }
    if (!await allowed(req)) { res.setHeader('Retry-After', '3600'); return send(429, { next, csrf: current.csrf, error: 'Too many sign-in attempts. Please try again in one hour.' }); }
    if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 100 || body.password.length > 256 || !auth.basicAuthorized({ headers: { authorization: 'Basic ' + Buffer.from(body.username + ':' + body.password).toString('base64') } })) return send(401, { next, csrf: current.csrf, error: 'The username or password did not match. Please try again.' });
    current.user = auth.user();
    current.expiresAt = Date.now() + auth.SESSION_SECONDS * 1000;
    current.csrf = randomBytes(32).toString('hex');
    await current.save();
    return redirect(next);
  } catch {
    console.error('INQUIRY_INBOX_UNAVAILABLE', { stage: 'team-sign-in' });
    return send(503, { configured: false, error: 'Team sign in is temporarily unavailable. Please try again shortly.' });
  }
};
module.exports.page = page;
module.exports.allowed = allowed;
