// Team login shared by /staff and its endpoints: HTTP Basic auth, username
// STAFF_USER (default "team") and the STAFF_PASSWORD Vercel env var. With no
// password set, nobody gets in.
const crypto = require('crypto');

const digest = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function authorized(req) {
  const password = process.env.STAFF_PASSWORD;
  if (!password) return false;
  const user = process.env.STAFF_USER || 'team';
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // Check both so the time taken doesn't reveal which one was wrong
  const userOk = same(decoded.slice(0, i), user);
  const passOk = same(decoded.slice(i + 1), password);
  return userOk && passOk;
}

module.exports = { authorized };
