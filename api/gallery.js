// Public client gallery: /gallery/<token>
//
// No staff login — the 64-hex gallery token IS the access control, and it
// expires (30 days by default, see lib/delivery.js). Only approved edited
// files and tour/video embeds are shown; originals and drafts are never
// exposed here. noindex everywhere.
const store = require('../lib/private-store');
const delivery = require('../lib/delivery');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function findByToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  const list = await store.list('delivery/shoots/', { limit: 50 }).catch(() => ({ items: [] }));
  for (const item of list.items) {
    const rec = await store.read(item.path).catch(() => null);
    if (rec?.value?.galleryToken === token) return rec.value;
  }
  return null;
}

function page(shoot) {
  const tours = Object.entries(shoot.tours || {}).filter(([, v]) => v).map(([k, v]) => {
    const embed = delivery.embedUrl(v);
    return embed
      ? `<figure><figcaption>${esc(k)}</figcaption><iframe src="${esc(embed)}" loading="lazy" allowfullscreen></iframe></figure>`
      : `<p><a href="${esc(v)}" target="_blank" rel="noopener">${esc(k)} — open link</a></p>`;
  }).join('');
  const photos = (shoot.files?.edited || []).map(f =>
    `<figure><img src="${esc(f.url)}" alt="${esc(f.filename)}" loading="lazy"><figcaption>${esc(f.filename)}</figcaption></figure>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(shoot.address)} — photos | Listing Pixl</title><link rel="icon" href="/favicon.svg"><style>
  *{box-sizing:border-box}body{margin:0;font:16px/1.6 Arial,sans-serif;color:#1d1d1d;background:#faf8f3}main{max-width:960px;margin:0 auto;padding:2rem 16px 4rem}h1{font-size:1.5rem}figure{margin:1rem 0}img{width:100%;height:auto;border-radius:12px;display:block}iframe{width:100%;height:480px;border:0;border-radius:12px;background:#fff}figcaption{font-size:.9rem;color:#666;margin-top:.4rem}.note{background:#fff7e0;border-radius:8px;padding:.75rem 1rem;font-size:.9rem}
  </style></head><body><main>
  <h1>${esc(shoot.address)}${shoot.city ? ', ' + esc(shoot.city) : ''}</h1>
  <p>Photos by Listing Pixl. MLS-ready files are 2048px, sRGB, under 2 MB.</p>
  ${photos || '<p class="note">Photos are being prepared — check back soon.</p>'}
  ${tours ? `<h2>Tours &amp; video</h2>${tours}` : ''}
  <p class="note">Photos marked Virtually Staged or Virtually Landscaped are digital renderings — the original photos are in the same gallery, same angle. This link expires ${esc((shoot.galleryExpiresAt || '').slice(0, 10))}.</p>
  </main></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const token = req.query?.token || new URL(req.url, 'http://x').searchParams.get('token') || '';
  try {
    const shoot = await findByToken(token);
    if (!shoot) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain'); return res.end('This gallery link is not valid.'); }
    if (delivery.galleryExpired(shoot)) { res.statusCode = 410; res.setHeader('Content-Type', 'text/plain'); return res.end('This gallery link has expired. Ask Listing Pixl for a fresh link.'); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(page(shoot));
  } catch {
    res.statusCode = 503; res.setHeader('Content-Type', 'text/plain'); res.end('Gallery is temporarily unavailable.');
  }
};
module.exports._findByToken = findByToken;
