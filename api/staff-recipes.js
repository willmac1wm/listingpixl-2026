// Recipe Studio API for /staff: run recipe batches against the OpenAI
// Images API and approve the results. Same team login as /staff; writes
// need the X-Staff header (see api/shoots.js).
//
// How a batch actually runs: the Images API returns ONE image per call, so
// "one batch" means one run, one call per angle — chained. Angle 1 is
// edited with the recipe prompt only, and its finished result becomes the
// reference the rest are matched to: each remaining angle is sent with
// TWO images (finished angle 1 first, the raw angle second) and the
// recipe prompt with the chain prefix in front. The rest run in parallel
// with each other once angle 1 is done; angle 1 must finish first. There
// is no anchor from the user and no pre-built anchor — the anchor is
// created by the app itself, from his own first photo, inside the batch.
// "Test one angle first" is the same as step 1 of a batch: one angle,
// prompt only, and its result is the look the rest would be matched to.
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

// Staff-edited prompt overrides: stored in private Blob, staff-only, the
// same pattern as the saved API key. The override is never in the repo and
// never in a public file, and editing here never rewrites data/recipes.json.
async function resolvePrompt(recipe) {
  const saved = await store.read(recipes.promptOverridePath(recipe.id)).catch(() => null);
  return recipes.effectivePrompt(recipe, saved?.value || null);
}

async function savePromptOverride(recipe, prompt) {
  let text;
  try { text = recipes.validatePromptText(prompt); }
  catch (e) { throw new HttpError(400, e.message); }
  const value = { recipeId: recipe.id, prompt: text, updatedAt: new Date().toISOString() };
  const path = recipes.promptOverridePath(recipe.id);
  const existing = await store.read(path).catch(() => null);
  if (existing) await store.write(path, value, existing.etag);
  else await store.create(path, value);
  return value;
}

async function editOne(key, model, prompt, images) {
  const form = recipes.buildEditFormData({ model, prompt, images });
  const r = await fetch(OPENAI_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new HttpError(502, `OpenAI images/edits: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, 'OpenAI returned no image.');
  return b64;
}

const actions = {
  async recipes() { return { version: recipes.RECIPES.version, recipes: recipes.listRecipes(), plannedStyles: recipes.listPlannedStyles() }; },

  // "Recipe prompts" section: for each live recipe, the exact prompt a
  // batch will run, where it came from, and the lists it was built from.
  // Staff login only — the handler 401s before this is ever reached.
  async prompts() {
    const out = [];
    for (const recipe of recipes.RECIPES.recipes) {
      const saved = await store.read(recipes.promptOverridePath(recipe.id)).catch(() => null);
      out.push(recipes.promptDetails(recipe, saved?.value || null));
    }
    return { prompts: out, plannedStyles: recipes.listPlannedStyles() };
  },

  async savePrompt(body) {
    const recipe = recipes.getRecipe(String(body.recipeId || ''));
    if (!recipe) throw new HttpError(400, 'That recipe has no prompt to edit — planned styles have no prompt yet.');
    const saved = await savePromptOverride(recipe, body.prompt);
    return { ok: true, recipeId: recipe.id, source: 'override', updatedAt: saved.updatedAt };
  },

  async resetPrompt(body) {
    const recipe = recipes.getRecipe(String(body.recipeId || ''));
    if (!recipe) throw new HttpError(400, 'That recipe has no prompt to reset — planned styles have no prompt yet.');
    const path = recipes.promptOverridePath(recipe.id);
    const existing = await store.read(path).catch(() => null);
    if (existing) await store.remove(path, existing.etag).catch(() => {});
    return { ok: true, recipeId: recipe.id, source: 'pack' };
  },

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
    // The batch runs the staff-edited prompt when one exists, the pack
    // default otherwise. The record says which one it was.
    const { prompt, source: promptSource } = await resolvePrompt(recipe);
    const shootSlug = String(body.shootSlug || '').slice(0, 120);
    if (shootSlug && !delivery.SLUG.test(shootSlug)) throw new HttpError(400, 'Bad shoot slug.');
    const space = String(body.space || 'space').slice(0, 80);
    const onlyFirst = body.onlyFirst === true;
    const targets = onlyFirst ? images.slice(0, 1) : images;
    // Chain anchor, in order. Step 1: angle 1 is edited with the recipe
    // prompt only — that finished photo sets the look for the batch.
    const firstB64 = await editOne(key, model, prompt, [targets[0]]);
    const first = { angleName: targets[0].name, editedFilename: recipes.editedFilename(targets[0].name, recipe.id), mime: 'image/png', dataUrl: `data:image/png;base64,${firstB64}` };
    const results = [first];
    let chained = false;
    if (targets.length > 1) {
      // Step 2: the finished angle 1 becomes the reference. Each remaining
      // angle is edited with the reference + the raw angle, and the chained
      // prompt. The rest run in parallel with each other — angle 1 is done.
      chained = true;
      const reference = { name: first.editedFilename, mime: 'image/png', buffer: Buffer.from(firstB64, 'base64') };
      const chainedPrompt = recipes.chainedPrompt(prompt);
      const rest = await Promise.all(targets.slice(1).map(async (angle) => {
        const b64 = await editOne(key, model, chainedPrompt, [reference, angle]);
        return { angleName: angle.name, editedFilename: recipes.editedFilename(angle.name, recipe.id), mime: 'image/png', dataUrl: `data:image/png;base64,${b64}` };
      }));
      results.push(...rest);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, recipeId: recipe.id, shootSlug, space, createdAt: new Date().toISOString(), angles: images.map(i => i.name), status: 'ran', promptSource, chained, referenceFilename: chained ? first.editedFilename : null, results: results.map(r => ({ angleName: r.angleName, editedFilename: r.editedFilename })) };
    await store.create(batchPath(id), record).catch(() => {});
    return { ok: true, batchId: id, model, promptSource, results, chained, referenceFilename: chained ? first.editedFilename : null };
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
    // The approved set is saved for this space.
    const updated = { ...batch, status: 'approved', approvedAt: new Date().toISOString(), approvedFiles: saved, anchorUrl: saved[0]?.url || null };
    await store.write(batchPath(id), updated, current.etag).catch(() => {});
    return { ok: true, batchId: id, saved };
  },
};

const POSTS = new Set(['saveKey', 'deleteKey', 'savePrompt', 'resetPrompt', 'runBatch', 'approve']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  const action = new URL(req.url, 'http://x').searchParams.get('action');
  // A plain browser visit to /staff/recipes has no action: it is a person,
  // not an API call, so send them to the Recipe Studio section of the
  // /staff dashboard instead of a blank JSON error page. /staff itself
  // sends unauthenticated visitors to the login page.
  if (!action && req.method === 'GET') {
    res.statusCode = 302;
    res.setHeader('Location', '/staff#recipe-studio');
    return res.end();
  }
  if (!await authorized(req, res)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
    return send(401, { error: 'Team login required.' });
  }
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
