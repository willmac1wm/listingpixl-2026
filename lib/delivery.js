// Delivery-service / mini-CRM logic for the /staff Delivery section.
//
// Pure functions only — no I/O, no secrets, no sending. There is deliberately
// NO send function in this codebase: delivery text/email/follow-up/review
// strings are editable DRAFTS. Nothing goes out from here; William approves
// the exact final text in chat first, every time.
//
// Storage: shoot records live in private Vercel Blob via lib/private-store
// (delivery/shoots/<slug>.json). Approved edited photos live in public Blob
// under listingpixl/delivery/<slug>/ so the token gallery can show them.
// HD Photo Hub stays the fallback for ordering / pricing / checkout.
const { randomBytes } = require('node:crypto');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = ['shot', 'editing', 'ready', 'delivered', 'followed-up', 'reviewed'];
const PACKAGES = ['Essential', 'Standard', 'Marketing', 'Luxury', 'Signature', 'Vacation Rental'];
const GALLERY_TTL_DAYS = 30;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const cleanUrl = (v, max = 1000) => clean(v, max).replace(/[\r\n]+/g, '');

function slugFor(address, city) {
  const slug = `${address || ''} ${city || ''} nj`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!SLUG.test(slug) || slug.length > 120) throw Error('Bad shoot slug — needs an address.');
  return slug;
}

// Delivery drafts, verbatim from the Recipe Pack delivery checklist appendix.
// [placeholders] are filled from the shoot record when shown, never sent.
function deliveryDrafts(shoot) {
  const address = shoot.address || '[Address]';
  const agent = shoot.agentName || '[Agent]';
  const n = shoot.photoCount || '[N]';
  const link = shoot.galleryUrl || '[gallery link]';
  return {
    text: `Hi ${agent}, your photos for ${address} are ready — ${n} photos, MLS-ready + full-res in your gallery: ${link}. Virtually staged / landscaped photos are labelled in the filenames and in the MLS remarks. Let me know if you want any swaps.`,
    emailSubject: `Your photos are ready — ${address}`,
    emailBody: `Hi ${agent}, your ${n} photos for ${address} are ready in your gallery: ${link}. MLS-ready files are in the gallery, full-res files are there too. Any photos marked Virtually Staged / Virtually Landscaped are digital renderings — the originals are in the same gallery, same angle. Reply if you want a swap or a different crop.`,
    followUp: `Hi ${agent}, checking the photos for ${address} all uploaded okay to the MLS? Happy to resize or swap anything.`,
    reviewAsk: `Glad the photos are live — if they helped, a quick Google review for Listing Pixl would mean a lot: [review link].`,
  };
}

function newShoot(body) {
  const slug = slugFor(body.address, body.city);
  return {
    slug,
    address: clean(body.address, 200), city: clean(body.city, 100),
    agentName: clean(body.agentName, 100), agentEmail: clean(body.agentEmail, 200),
    agentPhone: clean(body.agentPhone, 40), brokerage: clean(body.brokerage, 100),
    package: PACKAGES.includes(body.package) ? body.package : 'Essential',
    status: 'shot', shotDate: clean(body.shotDate, 10) || new Date().toISOString().slice(0, 10),
    hdphSiteId: clean(body.hdphSiteId, 20).replace(/\D/g, ''),
    stripePaymentLink: cleanUrl(body.stripePaymentLink),
    photoCount: Number.isSafeInteger(body.photoCount) ? body.photoCount : 0,
    tours: { matterport: '', kuula: '', iguide: '', youtube: '', video: '' },
    files: { edited: [], mlsReady: [] },
    galleryToken: newGalleryToken(), galleryExpiresAt: galleryExpiry(),
    drafts: null, // filled from deliveryDrafts() on first save/view
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function validateShoot(shoot) {
  if (!shoot || !SLUG.test(shoot.slug || '')) throw Error('Bad shoot slug.');
  if (!shoot.address) throw Error('Shoot needs an address.');
  if (!STATUSES.includes(shoot.status)) throw Error('Bad shoot status.');
  if (shoot.package && !PACKAGES.includes(shoot.package)) throw Error('Bad package.');
  if (shoot.stripePaymentLink && !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com|pay\.stripe\.com)\//.test(shoot.stripePaymentLink)) throw Error('Stripe Payment Link must be a buy.stripe.com / checkout.stripe.com link.');
  for (const [k, v] of Object.entries(shoot.tours || {})) {
    if (v && !/^https:\/\//.test(v)) throw Error(`Tour link (${k}) must be an https URL.`);
  }
  return shoot;
}

function applyShootEdits(current, body) {
  const next = { ...current, updatedAt: new Date().toISOString() };
  for (const k of ['agentName', 'agentEmail', 'agentPhone', 'brokerage', 'shotDate']) next[k] = clean(body[k], k === 'agentEmail' ? 200 : 100);
  if (body.package && PACKAGES.includes(body.package)) next.package = body.package;
  if (body.status && STATUSES.includes(body.status)) next.status = body.status;
  if (body.hdphSiteId !== undefined) next.hdphSiteId = clean(body.hdphSiteId, 20).replace(/\D/g, '');
  if (body.stripePaymentLink !== undefined) next.stripePaymentLink = cleanUrl(body.stripePaymentLink);
  if (Number.isSafeInteger(body.photoCount)) next.photoCount = body.photoCount;
  if (body.tours) for (const k of Object.keys(next.tours)) if (body.tours[k] !== undefined) next.tours[k] = cleanUrl(body.tours[k]);
  if (body.drafts) {
    next.drafts = {};
    for (const k of ['text', 'emailSubject', 'emailBody', 'followUp', 'reviewAsk']) {
      next.drafts[k] = clean(body.drafts[k], 4000).replace(/\r\n/g, '\n');
    }
  }
  return validateShoot(next);
}

function newGalleryToken() { return randomBytes(32).toString('hex'); }
function galleryExpiry(from = Date.now()) { return new Date(from + GALLERY_TTL_DAYS * 86400e3).toISOString(); }
function galleryExpired(shoot, now = Date.now()) { return !shoot.galleryExpiresAt || Date.parse(shoot.galleryExpiresAt) <= now; }
function galleryUrlFor(req, shoot) {
  const host = req.headers.host || 'www.listingpixl.com';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}/gallery/${shoot.galleryToken}`;
}

// Tour / video links are plain URLs rendered as iframes — no API key, same
// as HD Photo Hub. Only these hosts are embeddable; anything else is shown
// as a plain link, never an iframe.
const EMBED_HOSTS = [
  { match: /^(?:www\.)?my\.matterport\.com$/, embed: u => u },
  { match: /^(?:www\.)?kuula\.co$/, embed: u => u },
  { match: /^(?:www\.)?iguide\.com$/, embed: u => u },
  { match: /^(?:www\.)?(?:youtube\.com|youtu\.be)$/, embed: u => {
    const m = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(u);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  } },
  { match: /^(?:www\.)?vimeo\.com$/, embed: u => {
    const m = /vimeo\.com\/(\d+)/.exec(u);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  } },
];
function embedUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:') return null;
    const host = EMBED_HOSTS.find(h => h.match.test(u.hostname));
    return host ? host.embed(u.toString()) : null;
  } catch { return null; }
}

module.exports = {
  SLUG, STATUSES, PACKAGES, GALLERY_TTL_DAYS, slugFor, deliveryDrafts,
  newShoot, validateShoot, applyShootEdits, newGalleryToken, galleryExpiry,
  galleryExpired, galleryUrlFor, embedUrl,
};
