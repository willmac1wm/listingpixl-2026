// Recipe Studio API for /staff: run recipe batches against the OpenAI
// Images API and approve the results. Same team login as /staff; writes
// need the X-Staff header (see api/shoots.js).
//
// How a batch actually runs: the Images API returns ONE image per call, so
// "one batch" means one run, same recipe prompt + same anchor, one call per
// target angle (anchor + that angle). That is the method the 2026-11-06
// tests used. The tool runs one angle first on request, so the first live
// run can be checked before the rest.
//
// API key: NEVER in the repo, NEVER in code, NEVER returned by any endpoint
// and NEVER logged. Resolution order:
//   1. OPENAI_API_KEY env var (Vercel — the recommended place), or
//   2. a key William saves in Staff Settings, kept in private Vercel Blob
//      (staff/recipe-settings.json) — staff-authenticated only.
// With no key anywhere the endpoints answer 503 "No OpenAI key configured"
// and the Studio UI shows that instead of a run button. No key = no calls,
// no spend. OpenAI image calls are pay-per-image on William's OpenAI
// billing; the Studio shows the recipe's $35/photo price anchor and asks
// for a confirm on every run.
const { authorized } = require('./_auth');
const store = require('../lib/private-store');
const { put } = require('@vercel/blob');
const recipes = require('../lib/recipes');
const delivery = require('../lib/delivery');

const SETTINGS_PATH = 'staff/recipe-settings.json';
const OPENAI_URL = 'https://api.openai.com/v1/images/edits';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function resolveKey() {
  if (process.env.OPENAI_API_KEY) return { key: process.env.OPENAI_API_KEY, source: 'env' };
  const saved = await store.read(SETTINGS_PATH).catch(() => null);
  if (saved?.value?.key) return { key: saved.value.key, source: 'staff-settings' };
  return { key: null, source: null };
}

function decodeImages(images) {
  if (!Array.isArray(images)) throw new HttpError(400, 'Images must be a list.');
  return images.map(img => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img?.dataUrl || ''));
    if (!m) throw new HttpError(400, `Image ${img?.name || ''} is not a JPEG/PNG/WebP data URL.`);
    const buffer = Buffer.from(m[2], 'base64');
    return { name: String(img.name || 'angle.jpg').slice(0, 120), mime: m[1], buffer, bytes: buffer.length };
  });
}

function batchPath(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new HttpError(400, 'Bad batch id.');
  return `recipes/batches/${id}.json`;
}

async function saveSettings(key) {
  if (typeof key !== 'string' || !/^sk-[A-Za-z0-9_-]{20,200}$/.test(key.trim())) throw new HttpError(400, 'That does not look like an OpenAI API key.');
  const value = { key: key.trim(), updatedAt: new Date().toISOString(), source: 'staff-settings' };
  const existing = await store.read(SETTINGS_PATH).catch(() => null);
  if (existing) await store.write(SETTINGS_PATH, value, existing.etag);
  else await store.create(SETTINGS_PATH, value);
  return { configured: true, source: 'staff-settings' };
}

const actions = {
  async recipes() { return { version: recipes.RECIPES.version, recipes: recipes.listRecipes(), plannedStyles: recipes.listPlannedStyles() }; },

  async settingsStatus() {
    const { source } = await resolveKey();
    return { configured: Boolean(source), source, note: source === 'env' ? 'Key is set in Vercel environment variables.' : source ? 'Key was saved in Staff Settings.' : 'No OpenAI key configured — batch runs are disabled.' };
  },

  async saveKey(body) {
    const out = await saveSettings(body.key);
    return { ok: true, ...out };
  },

  async deleteKey() {
    const existing = await store.read(SETTINGS_PATH).catch(() => null);
    if (existing) await store.remove(SETTINGS_PATH, existing.etag).catch(() => {});
    return { ok: true, configured: Boolean(process.env.OPENAI_API_KEY), source: process.env.OPENAI_API_KEY ? 'env' : null };
  },

  async batches() {
    const list = await store.list('recipes/batches/', { limit: 20 }).catch(() => ({ items: [] }));
    const out = [];
    for (const item of list.items) {
      const rec = await store.read(item.path).catch(() => null);
      if (rec) out.push({ ...rec.value, results: undefined });
    }
    return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async runBatch(body) {
    let recipe;
    try {
      recipe = recipes.validateBatch(body.recipeId, decodeImages(body.images || []).map(i => ({ name: i.name, mime: i.mime, bytes: i.bytes })), { landscapedApproved: body.landscapedApproved === true });
    } catch (e) { throw new HttpError(400, e.message); }
    const images = decodeImages(body.images);
    const { key } = await resolveKey();
    if (!key) throw new HttpError(503, 'No OpenAI key configured. Save one in Staff Settings (or set OPENAI_API_KEY in Vercel) before running a batch.');
    let model;
    try { model = recipes.modelFor(recipe, body.model); }
    catch (e) { throw new HttpError(400, e.message); }
    const prompt = recipes.buildPrompt(recipe);
    const shootSlug = String(body.shootSlug || '').slice(0, 120);
    if (shootSlug && !delivery.SLUG.test(shootSlug)) throw new HttpError(400, 'Bad shoot slug.');
    const space = String(body.space || 'space').slice(0, 80);
    const onlyFirst = body.onlyFirst === true;
    const targets = onlyFirst ? images.slice(1, 2) : images.slice(1);
    const anchor = images[0];
    const results = [];
    // One API call per angle: anchor + that angle, same prompt every time.
    for (const angle of targets) {
      const form = recipes.buildEditFormData({ model, prompt, images: [anchor, angle] });
      const r = await fetch(OPENAI_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new HttpError(502, `OpenAI images/edits: ${r.status} ${(await r.text()).slice(0, 300)}`);
      const data = await r.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) throw new HttpError(502, 'OpenAI returned no image.');
      results.push({ angleName: angle.name, editedFilename: recipes.editedFilename(angle.name, recipe.id), mime: 'image/png', dataUrl: `data:image/png;base64,${b64}` });
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, recipeId: recipe.id, shootSlug, space, createdAt: new Date().toISOString(), anchorName: anchor.name, angles: images.slice(1).map(i => i.name), status: 'ran', results: results.map(r => ({ angleName: r.angleName, editedFilename: r.editedFilename })) };
    await store.create(batchPath(id), record).catch(() => {});
    return { ok: true, batchId: id, model, results };
  },

  async approve(body) {
    const id = String(body.batchId || '');
    const current = await store.read(batchPath(id)).catch(() => null);
    if (!current) throw new HttpError(404, 'That batch is gone.');
    const batch = current.value;
    const approvals = Array.isArray(body.approvals) ? body.approvals : [];
    if (!approvals.length) throw new HttpError(400, 'Approve at least one angle.');
    const saved = [];
    for (const a of approvals) {
      const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(a.dataUrl || ''));
      if (!m) throw new HttpError(400, `Approved image for ${a.angleName || ''} is not a valid image.`);
      const filename = recipes.editedFilename(a.angleName, batch.recipeId);
      const spaceSlug = String(batch.space || 'space').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'space';
      const path = `listingpixl/delivery/${batch.shootSlug || 'unsorted'}/${spaceSlug}/${filename}`;
      const blob = await put(path, Buffer.from(m[2], 'base64'), { access: 'public', contentType: m[1], addRandomSuffix: false, allowOverwrite: true });
      saved.push({ angleName: a.angleName, filename, url: blob.url });
    }
    // The approved set becomes the new anchor for this space.
    const updated = { ...batch, status: 'approved', approvedAt: new Date().toISOString(), approvedFiles: saved, anchorUrl: saved[0]?.url || null };
    await store.write(batchPath(id), updated, current.etag).catch(() => {});
    return { ok: true, batchId: id, saved };
  },
};

const POSTS = new Set(['saveKey', 'deleteKey', 'runBatch', 'approve']);

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
    send(200, await actions[action](body || {}));
  } catch (e) {
    send(e.status || 500, { error: e.message });
  }
};
module.exports._actions = actions;
