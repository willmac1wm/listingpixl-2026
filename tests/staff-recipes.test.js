const { test } = require('node:test');
const assert = require('node:assert/strict');
const recipes = require('../lib/recipes');
const handler = require('../api/staff-recipes');
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
const tinyPng = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

// In-memory private store for these tests.
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

test('recipes list comes from data/recipes.json v1.1 with all three recipes', () => {
  const list = recipes.listRecipes();
  assert.deepEqual(list.map(r => r.id), ['vl-lush-lawn-autumn', 'vs-modern-farmhouse-kitchen', 'vt-virtual-twilight']);
  assert.equal(recipes.RECIPES.version, '1.1');
  assert.match(recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt, /lawn is the hero/i);
});

test('twilight is gated: only on an approved landscaped anchor, never a dirt yard', () => {
  const imgs = [{ name: 'a-Virtually-Landscaped.jpg', mime: 'image/jpeg', bytes: 100 }, { name: 'b.jpg', mime: 'image/jpeg', bytes: 100 }];
  assert.throws(() => recipes.validateBatch('vt-virtual-twilight', imgs, { landscapedApproved: false }), /Landscape first/);
  assert.throws(() => recipes.validateBatch('vt-virtual-twilight', [{ name: 'a.jpg', mime: 'image/jpeg', bytes: 100 }, imgs[1]], { landscapedApproved: true }), /Virtually-Landscaped file/);
  assert.ok(recipes.validateBatch('vt-virtual-twilight', imgs, { landscapedApproved: true }));
});

test('batch limits: anchor + at most 3 angles, 5 MB per image, JPEG/PNG/WebP only', () => {
  const img = { name: 'a.jpg', mime: 'image/jpeg', bytes: 100 };
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img]), /at least one angle/);
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img, img, img, img, img]), /at most 3 angles/);
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img, { ...img, bytes: 6 * 1024 * 1024 }]), /5 MB/);
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img, { ...img, mime: 'image/gif' }]), /Only JPEG, PNG or WebP/);
});

test('edited filenames never overwrite originals and use the recipe suffix', () => {
  assert.equal(recipes.editedFilename('114-E-Anna-St-01-Front-Exterior.jpg', 'vl-lush-lawn-autumn'), '114-E-Anna-St-01-Front-Exterior-Virtually-Landscaped.jpg');
  assert.equal(recipes.editedFilename('114-E-Anna-St-42-Dining-Living.jpg', 'vs-modern-farmhouse-kitchen'), '114-E-Anna-St-42-Dining-Living-Virtually-Staged.jpg');
  assert.equal(recipes.editedFilename('114-E-Anna-St-01-Front-Exterior-Virtually-Landscaped.jpg', 'vt-virtual-twilight'), '114-E-Anna-St-01-Front-Exterior-Virtually-Landscaped-Twilight.jpg');
});

test('gpt-image-1 is refused; the prompt is the recipe prompt verbatim', () => {
  assert.throws(() => recipes.modelFor(recipes.getRecipe('vl-lush-lawn-autumn'), 'gpt-image-1'), /shut down 2026-10-23/);
  assert.equal(recipes.modelFor(recipes.getRecipe('vl-lush-lawn-autumn')), 'gpt-image-1.5');
  const r = recipes.getRecipe('vs-modern-farmhouse-kitchen');
  assert.equal(recipes.buildPrompt(r), r.prompt_chatgpt);
});

test('edit form data puts the anchor first, then the angle, with the recipe prompt', () => {
  const form = recipes.buildEditFormData({ model: 'gpt-image-1.5', prompt: 'PROMPT', images: [
    { name: 'anchor.jpg', mime: 'image/jpeg', buffer: Buffer.from('a') },
    { name: 'angle.jpg', mime: 'image/jpeg', buffer: Buffer.from('b') },
  ] });
  assert.equal(form.get('model'), 'gpt-image-1.5');
  assert.equal(form.get('prompt'), 'PROMPT');
  assert.equal(form.getAll('image[0]').length, 1);
  assert.equal(form.getAll('image[1]').length, 1);
});

test('run-batch needs team login, refuses with no key, and makes one OpenAI call per angle', async () => {
  const restoreStore = memoryStore();
  const oldPass = process.env.STAFF_PASSWORD;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  delete process.env.OPENAI_API_KEY;
  try {
    const anon = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=recipes', headers: headers() }, anon);
    assert.equal(anon.statusCode, 401);

    const noKey = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }] }) }, noKey);
    assert.equal(noKey.statusCode, 503);
    assert.match(noKey.body, /No OpenAI key configured/);

    // Save a key via the staff form, then run: 2 angles = 2 OpenAI calls.
    const saved = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=saveKey', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ key: 'sk-test-' + 'x'.repeat(30) }) }, saved);
    assert.equal(saved.statusCode, 200);
    assert.doesNotMatch(saved.body, /sk-test/); // the key is never echoed back

    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, auth: opts.headers.Authorization });
      return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('edited').toString('base64') }] }) };
    };
    const run = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', shootSlug: '114-e-anna-st-whitesboro-nj', space: 'front yard', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }, { name: 'c.jpg', dataUrl: tinyPng }] }) }, run);
    assert.equal(run.statusCode, 200);
    assert.equal(calls.length, 2); // one call per angle, anchor + angle each time
    assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
    assert.ok(calls[0].auth.startsWith('Bearer sk-test-'));
    const out = JSON.parse(run.body);
    assert.equal(out.results.length, 2);
    assert.equal(out.results[0].editedFilename, 'b-Virtually-Landscaped.jpg');
    assert.doesNotMatch(run.body, /sk-test/);
  } finally {
    global.fetch = oldFetch;
    restoreStore();
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test('writes without the X-Staff header are rejected', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const res = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=saveKey', headers: headers({ authorization: basic(), 'content-type': 'application/json' }), body: JSON.stringify({ key: 'sk-test-' + 'x'.repeat(30) }) }, res);
    assert.equal(res.statusCode, 403);
  } finally {
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});
