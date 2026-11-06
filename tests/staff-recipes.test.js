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

test('recipes list comes from data/recipes.json v1.2 with all four recipes', () => {
  const list = recipes.listRecipes();
  assert.deepEqual(list.map(r => r.id), ['vl-lush-lawn-autumn', 'vs-modern-farmhouse-kitchen', 'vt-virtual-twilight', 'mb-modern-beach-interior']);
  assert.equal(recipes.RECIPES.version, '1.2');
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

test('photo picker: recipes split Interior / Exterior, each with a real button photo in the repo', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.deepEqual(recipes.recipesByCategory('interior').map(r => r.id), ['vs-modern-farmhouse-kitchen', 'mb-modern-beach-interior']);
  assert.deepEqual(recipes.recipesByCategory('exterior').map(r => r.id), ['vl-lush-lawn-autumn', 'vt-virtual-twilight']);
  assert.throws(() => recipes.recipesByCategory('attic'), /Interior or Exterior/);
  for (const r of recipes.listRecipes()) {
    assert.match(r.button_image, /^\/images\/recipes\/[a-z0-9-]+\.jpg$/, `${r.id} button image path`);
    const onDisk = path.join(__dirname, '..', r.button_image);
    assert.ok(fs.existsSync(onDisk), `${r.button_image} exists in the repo`);
    const buf = fs.readFileSync(onDisk);
    assert.equal(buf[0], 0xff); assert.equal(buf[1], 0xd8); // real JPEG, not a placeholder
    assert.ok(buf.length > 10000, `${r.button_image} is a real photo, not an empty file`);
  }
  // The step-1 buttons use the same real photos: kitchen for Interior,
  // lush lawn for Exterior.
  assert.equal(recipes.recipesByCategory('interior')[0].button_image, '/images/recipes/modern-farmhouse-kitchen.jpg');
  assert.equal(recipes.recipesByCategory('exterior')[0].button_image, '/images/recipes/lush-lawn-autumn.jpg');
});

test('coming-soon styles are names only: planned, no recipe, no photo, never selectable', () => {
  const planned = recipes.listPlannedStyles();
  assert.deepEqual(planned.map(s => s.name), ['Minimal', 'Classic', 'Victorian']);
  for (const s of planned) {
    assert.equal(s.status, 'planned');
    assert.equal(s.category, 'interior');
    assert.equal(s.button_image, undefined);
    assert.equal(s.prompt_chatgpt, undefined);
    assert.equal(recipes.getRecipe(s.name), null); // no recipe behind the name
    assert.throws(() => recipes.validateBatch(s.name, [{ name: 'a.jpg', mime: 'image/jpeg', bytes: 100 }, { name: 'b.jpg', mime: 'image/jpeg', bytes: 100 }]), /Unknown recipe/);
  }
  assert.deepEqual(recipes.plannedStylesByCategory('interior').map(s => s.name), ['Minimal', 'Classic', 'Victorian']);
  assert.deepEqual(recipes.plannedStylesByCategory('exterior'), []);
  assert.throws(() => recipes.plannedStylesByCategory('attic'), /Interior or Exterior/);
});

test('recipes API returns categories, button images and planned styles for the picker', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const res = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=recipes', headers: headers({ authorization: basic() }) }, res);
    assert.equal(res.statusCode, 200);
    const out = JSON.parse(res.body);
    assert.equal(out.recipes.length, 4);
    for (const r of out.recipes) assert.ok(['interior', 'exterior'].includes(r.category) && r.button_image.startsWith('/images/recipes/'));
    assert.deepEqual(out.plannedStyles.map(s => s.name), ['Minimal', 'Classic', 'Victorian']);
  } finally {
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});

test('Modern Beach Interior is a live Interior recipe, distinct from the farmhouse kitchen', () => {
  const r = recipes.getRecipe('mb-modern-beach-interior');
  assert.ok(r, 'recipe exists');
  assert.equal(r.category, 'interior');
  assert.equal(r.button_image, '/images/recipes/modern-beach-interior.jpg');
  assert.match(r.price_anchor, /\$35\/photo/);
  assert.equal(recipes.listPlannedStyles().some(s => s.name === 'Modern Beach'), false);
  // Locked coastal look, not farmhouse again.
  const locked = r.materials_locked.join(' ');
  assert.match(locked, /linen/i);
  assert.match(locked, /rattan/i);
  assert.match(locked, /whitewashed/i);
  assert.match(locked, /sea-blue/i);
  assert.doesNotMatch(locked, /cognac|leather|farmhouse/i);
  assert.doesNotMatch(r.prompt_chatgpt, /cognac/i);
  // Farmhouse appears only as a prohibition, never as a material.
  assert.match(r.prompt_chatgpt, /DO NOT.*farmhouse décor/i);
  assert.match(r.prompt_chatgpt, /rattan|whitewashed|sea-blue/i);
  assert.match(r.do_not.join(' '), /nautical kitsch|dark wood/i);
  assert.match(r.do_not.join(' '), /kitchen island/i);
  // The batch gate still applies: a valid batch validates, and the
  // recipe is selectable like the other live recipes.
  assert.doesNotThrow(() => recipes.validateBatch('mb-modern-beach-interior', [
    { name: 'anchor.jpg', mime: 'image/jpeg', bytes: 100 },
    { name: 'angle.jpg', mime: 'image/jpeg', bytes: 100 },
  ]));
});
