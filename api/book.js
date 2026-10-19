// Booking form handler: emails each "Lock In Your Shoot" request to Listing
// Pixl through Gmail, so visitors don't need an email app.
//
// Needs one Vercel environment variable: GMAIL_APP_PASSWORD, a Gmail app
// password for GMAIL_USER. Until it is set the endpoint answers 503 and the
// page falls back to opening the visitor's email app, so no booking is lost.
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || 'ListingPixl.Media@gmail.com';
const BOOKING_TO = process.env.BOOKING_TO || GMAIL_USER;
const ALLOWED_ORIGIN = /^https:\/\/(www\.)?listingpixl\.com$|^https:\/\/listingpixl-2026-[a-z0-9-]+\.vercel\.app$/;
const LIMITS = { name: 100, email: 200, phone: 40, package: 60, address: 200, date: 10, message: 2000 };

// Strip control characters and cap length; single-line fields also lose
// line breaks so nothing can be smuggled into email headers.
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const oneLine = s => s.replace(/[\r\n]+/g, ' ');

function prettyDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'Not given';
  const d = new Date(iso + 'T12:00:00Z');
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGIN.test(origin)) return res.status(403).json({ ok: false });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Bots fill the hidden "website" field or submit within moments of loading.
  // Answer as if it worked so they don't retry.
  const elapsed = Number(body.elapsed);
  if (body.website || (elapsed >= 0 && elapsed < 2500)) return res.status(200).json({ ok: true });

  const f = {};
  for (const k of Object.keys(LIMITS)) f[k] = clean(body[k], LIMITS[k]);
  for (const k of ['name', 'email', 'phone', 'package', 'address', 'date']) f[k] = oneLine(f[k]);
  if (!f.name || !f.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    return res.status(400).json({ ok: false, error: 'missing-fields' });
  }
  if (!process.env.GMAIL_APP_PASSWORD) return res.status(503).json({ ok: false, error: 'not-configured' });

  const pkg = f.package || 'Not sure yet';
  const received = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const text = [
    'New booking request from listingpixl.com',
    '',
    `Name: ${f.name}`,
    `Phone: ${f.phone}`,
    `Email: ${f.email}`,
    `Property address: ${f.address || 'Not given'}`,
    `Preferred date: ${prettyDate(f.date)}`,
    `Package: ${pkg}`,
    '',
    'Message:',
    f.message || '(none)',
    '',
    `Received ${received} (Eastern). Reply to this email to answer ${f.name} directly.`,
  ].join('\n');

  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transport.sendMail({
      from: { name: 'Listing Pixl website', address: GMAIL_USER },
      to: BOOKING_TO,
      replyTo: { name: f.name, address: f.email },
      subject: `New booking: ${f.address || f.name} (${pkg})`,
      text,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('booking email failed:', err && (err.code || err.message));
    return res.status(502).json({ ok: false, error: 'send-failed' });
  }
};
