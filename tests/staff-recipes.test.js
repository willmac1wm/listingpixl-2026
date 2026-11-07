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

test('twilight is gated: only on approved landscaped photos, never a dirt yard', () => {
  const imgs = [{ name: 'a-Virtually-Landscaped.jpg', mime: 'image/jpeg', bytes: 100 }, { name: 'b-Virtually-Landscaped.jpg', mime: 'image/jpeg', bytes: 100 }];
  assert.throws(() => recipes.validateBatch('vt-virtual-twilight', imgs, { landscapedApproved: false }), /Landscape first/);
  assert.throws(() => recipes.validateBatch('vt-virtual-twilight', [{ name: 'a.jpg', mime: 'image/jpeg', bytes: 100 }, imgs[1]], { landscapedApproved: true }), /Virtually-Landscaped file/);
  assert.ok(recipes.validateBatch('vt-virtual-twilight', imgs, { landscapedApproved: true }));
  assert.ok(recipes.validateBatch('vt-virtual-twilight', [imgs[0]], { landscapedApproved: true })); // one angle is enough
});

test('batch limits: 1–3 angles, 5 MB per image, JPEG/PNG/WebP only', () => {
  const img = { name: 'a.jpg', mime: 'image/jpeg', bytes: 100 };
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', []), /at least one angle/);
  assert.doesNotThrow(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img]));
  assert.throws(() => recipes.validateBatch('vs-modern-farmhouse-kitchen', [img, img, img, img]), /at most 3 angles/);
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

test('edit form data sends one angle with the recipe prompt — no anchor image', () => {
  const form = recipes.buildEditFormData({ model: 'gpt-image-1.5', prompt: 'PROMPT', images: [
    { name: 'angle.jpg', mime: 'image/jpeg', buffer: Buffer.from('b') },
  ] });
  assert.equal(form.get('model'), 'gpt-image-1.5');
  assert.equal(form.get('prompt'), 'PROMPT');
  assert.equal(form.getAll('image[0]').length, 1);
  assert.equal(form.getAll('image[1]').length, 0); // never a second image
});

test('chain anchor: the chained prompt puts the finished angle 1 first, then the recipe prompt verbatim', () => {
  assert.equal(recipes.chainedPrompt('PROMPT'), 'Image 1 is the finished look from this same space — match it exactly. PROMPT');
  for (const r of recipes.listRecipes()) {
    const p = recipes.getRecipe(r.id).prompt_chatgpt;
    // Both call shapes read correctly: angle 1 runs the prompt alone
    // ("Edit this photo…"), the rest run the prefix + the same prompt.
    assert.ok(recipes.chainedPrompt(p).startsWith(recipes.CHAIN_PREFIX));
    assert.ok(recipes.chainedPrompt(p).endsWith(p));
  }
});

test('no anchor anywhere in the run path: no recipe prompt references an anchor image', () => {
  for (const r of recipes.listRecipes()) {
    const p = recipes.getRecipe(r.id).prompt_chatgpt;
    assert.doesNotMatch(p, /anchor image|Image 1 is the anchor|as the anchor/i, `${r.id} prompt must not reference an anchor image`);
  }
  // "anchors" in the Modern Beach DO NOT list is anchor-shaped beach
  // décor, not an anchor image — that one stays.
  assert.match(recipes.getRecipe('mb-modern-beach-interior').prompt_chatgpt, /nautical kitsch, anchors, rope/i);
});

test('run-batch needs team login, refuses with no key, and chains: angle 1 first, rest matched to it', async () => {
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

    // Save a key via the staff form, then run: 3 angles = 3 OpenAI calls,
    // chained — angle 1 first (prompt only), then the rest matched to it.
    const saved = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=saveKey', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ key: 'sk-test-' + 'x'.repeat(30) }) }, saved);
    assert.equal(saved.statusCode, 200);
    assert.doesNotMatch(saved.body, /sk-test/); // the key is never echoed back

    const calls = [];
    const packPrompt = recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt;
    global.fetch = async (url, opts) => {
      const n = calls.length;
      calls.push({ url, auth: opts.headers.Authorization, body: opts.body });
      return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('edited-' + n).toString('base64') }] }) };
    };
    const run = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', shootSlug: '114-e-anna-st-whitesboro-nj', space: 'front yard', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }, { name: 'c.jpg', dataUrl: tinyPng }] }) }, run);
    assert.equal(run.statusCode, 200);
    assert.equal(calls.length, 3); // one call per angle
    assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
    assert.ok(calls[0].auth.startsWith('Bearer sk-test-'));
    // Angle 1 runs first, prompt only, one image — it sets the look.
    assert.equal(calls[0].body.getAll('image[0]').length, 1);
    assert.equal(calls[0].body.getAll('image[1]').length, 0);
    assert.equal(calls[0].body.get('prompt'), packPrompt);
    // The rest are matched to the finished angle 1: reference + raw angle,
    // chained prompt. The reference is the first result, by bytes and name.
    for (const call of calls.slice(1)) {
      assert.equal(call.body.getAll('image[0]').length, 1);
      assert.equal(call.body.getAll('image[1]').length, 1);
      assert.equal(call.body.get('prompt'), recipes.chainedPrompt(packPrompt));
      assert.equal(call.body.get('image[0]').name, 'a-Virtually-Landscaped.jpg');
      assert.deepEqual(Buffer.from(await call.body.get('image[0]').arrayBuffer()), Buffer.from('edited-0'));
    }
    assert.equal(calls[1].body.get('image[1]').name, 'b.jpg');
    assert.equal(calls[2].body.get('image[1]').name, 'c.jpg');
    const out = JSON.parse(run.body);
    assert.equal(out.results.length, 3);
    assert.equal(out.results[0].editedFilename, 'a-Virtually-Landscaped.jpg');
    assert.equal(out.results[1].editedFilename, 'b-Virtually-Landscaped.jpg');
    assert.equal(out.results[2].editedFilename, 'c-Virtually-Landscaped.jpg');
    assert.equal(out.chained, true);
    assert.equal(out.referenceFilename, 'a-Virtually-Landscaped.jpg');
    assert.doesNotMatch(run.body, /sk-test/);

    // Test one angle first is the same as step 1 of a batch: one call,
    // prompt only, and its result is the look the rest would be matched to.
    calls.length = 0;
    const one = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: headers({ authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }], onlyFirst: true }) }, one);
    assert.equal(one.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.getAll('image[1]').length, 0);
    assert.equal(calls[0].body.get('prompt'), packPrompt);
    assert.equal(JSON.parse(one.body).chained, false);
    assert.equal(JSON.parse(one.body).results.length, 1);
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

test('prompt overrides: pack default unless staff edited it, planned styles have no editable prompt', () => {
  const r = recipes.getRecipe('vl-lush-lawn-autumn');
  const pack = recipes.effectivePrompt(r, null);
  assert.equal(pack.source, 'pack');
  assert.equal(pack.prompt, r.prompt_chatgpt);
  assert.equal(pack.updatedAt, null);
  const edited = recipes.effectivePrompt(r, { prompt: 'My edited prompt', updatedAt: '2026-11-06T12:00:00.000Z' });
  assert.equal(edited.source, 'override');
  assert.equal(edited.prompt, 'My edited prompt');
  assert.equal(edited.updatedAt, '2026-11-06T12:00:00.000Z');
  assert.equal(recipes.effectivePrompt(r, { prompt: '   ' }).source, 'pack'); // blank override = pack
  assert.throws(() => recipes.validatePromptText(''), /cannot be empty/);
  assert.throws(() => recipes.validatePromptText('x'.repeat(8001)), /too long/);
  assert.equal(recipes.validatePromptText('  keep it  '), '  keep it  ');
  assert.equal(recipes.promptOverridePath('vl-lush-lawn-autumn'), 'staff/recipe-prompts/vl-lush-lawn-autumn.json');
  assert.throws(() => recipes.promptOverridePath('../escape'), /Bad recipe id/);
  assert.equal(recipes.isEditableRecipe('vl-lush-lawn-autumn'), true);
  assert.equal(recipes.isEditableRecipe('Minimal'), false); // planned style, no prompt
  const d = recipes.promptDetails(r, { prompt: 'Edited', updatedAt: '2026-11-06T12:00:00.000Z' });
  assert.equal(d.prompt, 'Edited');
  assert.equal(d.packPrompt, r.prompt_chatgpt);
  assert.deepEqual(d.keep, r.keep);
  assert.deepEqual(d.change_only, r.change_only);
  assert.deepEqual(d.do_not, r.do_not);
});

test('Recipe prompts in /staff: edit, save, run with the override, reset to pack default', async () => {
  const restoreStore = memoryStore();
  const oldPass = process.env.STAFF_PASSWORD;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  delete process.env.OPENAI_API_KEY;
  const authed = extra => headers({ authorization: basic(), ...extra });
  try {
    // No prompt is ever returned to an unauthenticated caller.
    const anon = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=prompts', headers: headers() }, anon);
    assert.equal(anon.statusCode, 401);

    // Pack defaults first: all four live recipes, full prompt text, lists.
    const pack = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=prompts', headers: authed() }, pack);
    assert.equal(pack.statusCode, 200);
    const packOut = JSON.parse(pack.body);
    assert.equal(packOut.prompts.length, 4);
    for (const p of packOut.prompts) {
      assert.equal(p.source, 'pack');
      assert.equal(p.prompt, recipes.getRecipe(p.id).prompt_chatgpt);
      assert.ok(Array.isArray(p.keep) && p.keep.length > 0);
      assert.ok(Array.isArray(p.change_only) && p.change_only.length > 0);
      assert.ok(Array.isArray(p.do_not) && p.do_not.length > 0);
    }
    assert.deepEqual(packOut.plannedStyles.map(s => s.name), ['Minimal', 'Classic', 'Victorian']);

    // Writes need the X-Staff header; planned styles have no prompt to edit.
    const noHeader = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=savePrompt', headers: authed({ 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', prompt: 'Edited prompt' }) }, noHeader);
    assert.equal(noHeader.statusCode, 403);
    const planned = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=savePrompt', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'Minimal', prompt: 'Edited prompt' }) }, planned);
    assert.equal(planned.statusCode, 400);
    const empty = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=savePrompt', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', prompt: '   ' }) }, empty);
    assert.equal(empty.statusCode, 400);

    // Save an edited prompt: status flips to override with a saved time.
    const saved = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=savePrompt', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', prompt: 'Edited lawn prompt — lawn is the hero' }) }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(JSON.parse(saved.body).source, 'override');
    const after = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=prompts', headers: authed() }, after);
    const edited = JSON.parse(after.body).prompts.find(p => p.id === 'vl-lush-lawn-autumn');
    assert.equal(edited.source, 'override');
    assert.equal(edited.prompt, 'Edited lawn prompt — lawn is the hero');
    assert.ok(edited.updatedAt);
    assert.equal(edited.packPrompt, recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt);
    // The other three recipes are untouched, still pack defaults.
    assert.equal(JSON.parse(after.body).prompts.filter(p => p.source === 'pack').length, 3);

    // A batch runs the edited prompt, and the response says so.
    const keySaved = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=saveKey', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ key: 'sk-test-' + 'x'.repeat(30) }) }, keySaved);
    assert.equal(keySaved.statusCode, 200);
    const sentPrompts = [];
    global.fetch = async (url, opts) => {
      sentPrompts.push(opts.body.get('prompt'));
      return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('edited').toString('base64') }] }) };
    };
    const run = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }] }) }, run);
    assert.equal(run.statusCode, 200);
    assert.equal(JSON.parse(run.body).promptSource, 'override');
    assert.deepEqual(sentPrompts, ['Edited lawn prompt — lawn is the hero', recipes.chainedPrompt('Edited lawn prompt — lawn is the hero')]);

    // Reset deletes the override: pack default again, in the UI and in runs.
    const reset = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=resetPrompt', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn' }) }, reset);
    assert.equal(reset.statusCode, 200);
    assert.equal(JSON.parse(reset.body).source, 'pack');
    const back = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=prompts', headers: authed() }, back);
    const restored = JSON.parse(back.body).prompts.find(p => p.id === 'vl-lush-lawn-autumn');
    assert.equal(restored.source, 'pack');
    assert.equal(restored.prompt, recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt);
    sentPrompts.length = 0;
    const run2 = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=runBatch', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ recipeId: 'vl-lush-lawn-autumn', images: [{ name: 'a.jpg', dataUrl: tinyPng }, { name: 'b.jpg', dataUrl: tinyPng }] }) }, run2);
    assert.equal(JSON.parse(run2.body).promptSource, 'pack');
    assert.deepEqual(sentPrompts, [recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt, recipes.chainedPrompt(recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt)]);
  } finally {
    global.fetch = oldFetch;
    restoreStore();
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
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
    { name: 'angle1.jpg', mime: 'image/jpeg', bytes: 100 },
    { name: 'angle2.jpg', mime: 'image/jpeg', bytes: 100 },
  ]));
});

test('a plain browser visit to /staff/recipes redirects to the Recipe Studio page, never a JSON error', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const authed = response();
    await handler({ method: 'GET', url: '/staff/recipes', headers: headers({ authorization: basic() }) }, authed);
    assert.equal(authed.statusCode, 302);
    assert.equal(authed.getHeader('location'), '/staff/studio');
    assert.doesNotMatch(authed.body, /Unknown action/);

    // Same for a visitor who is not signed in yet — /staff sends them to
    // the login page; they never see a JSON error either.
    const anon = response();
    await handler({ method: 'GET', url: '/staff/recipes', headers: headers() }, anon);
    assert.equal(anon.statusCode, 302);
    assert.equal(anon.getHeader('location'), '/staff/studio');

    // An unknown action is still a JSON error — only the bare visit redirects.
    const bad = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=nope', headers: headers({ authorization: basic() }) }, bad);
    assert.equal(bad.statusCode, 400);
    assert.match(bad.body, /Unknown action/);
  } finally {
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});

test('settingsStatus reports where the key comes from, and deleting cannot remove the env key', async () => {
  const restoreStore = memoryStore();
  const oldPass = process.env.STAFF_PASSWORD;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  delete process.env.OPENAI_API_KEY;
  const authed = extra => headers({ authorization: basic(), ...extra });
  try {
    const none = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=settingsStatus', headers: authed() }, none);
    assert.equal(none.statusCode, 200);
    assert.deepEqual(JSON.parse(none.body), { configured: false, source: null, note: 'No OpenAI key configured — batch runs are disabled.' });

    const saved = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=saveKey', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({ key: 'sk-test-' + 'x'.repeat(30) }) }, saved);
    assert.equal(saved.statusCode, 200);
    const staffSettings = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=settingsStatus', headers: authed() }, staffSettings);
    assert.deepEqual(JSON.parse(staffSettings.body), { configured: true, source: 'staff-settings', note: 'Key was saved in Staff Settings.' });

    // The env var wins over the saved key, and deleting the saved key
    // leaves the env key in place — so Remove must never be offered for it.
    process.env.OPENAI_API_KEY = 'sk-env-' + 'x'.repeat(30);
    const env = response();
    await handler({ method: 'GET', url: '/staff/recipes?action=settingsStatus', headers: authed() }, env);
    assert.deepEqual(JSON.parse(env.body), { configured: true, source: 'env', note: 'Key is set in Vercel environment variables.' });
    const deleted = response();
    await handler({ method: 'POST', url: '/staff/recipes?action=deleteKey', headers: authed({ 'x-staff': '1', 'content-type': 'application/json' }), body: JSON.stringify({}) }, deleted);
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(JSON.parse(deleted.body), { ok: true, configured: true, source: 'env' });
  } finally {
    restoreStore();
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test('recipe settings live behind a closed door: warning + confirm first, prompts and key controls only after opening', () => {
  const ui = require('../api/_recipes_ui');
  // The door button is the only settings control outside the door.
  assert.match(ui.html, /id="rc-settings-open"/);
  assert.match(ui.html, /Recipe settings — advanced/);
  // Warning and contents both start hidden.
  assert.match(ui.html, /id="rc-settings-warning" hidden/);
  assert.match(ui.html, /id="rc-settings-body" hidden/);
  // The warning names what is at stake and needs an explicit confirm.
  assert.match(ui.html, /Changing a prompt changes every future batch/);
  assert.match(ui.html, /Changing or removing the key stops batch runs/);
  assert.match(ui.html, /id="rc-settings-confirm"/);
  assert.match(ui.html, /I understand, open settings/);
  // Prompts box and key form are inside the hidden settings body, and the
  // read-only key status line sits outside it.
  const bodyAt = ui.html.indexOf('id="rc-settings-body" hidden');
  assert.ok(bodyAt > -1);
  assert.ok(ui.html.indexOf('id="rc-prompts-box"', bodyAt) > bodyAt);
  assert.ok(ui.html.indexOf('id="rc-key-form"', bodyAt) > bodyAt);
  assert.ok(ui.html.indexOf('id="rc-key-status"') < ui.html.indexOf('id="rc-settings-door"'));
  // Key controls behind the door: input + Save shown there, no Change-key
  // link, Remove only for a Blob-saved key.
  assert.match(ui.html, /id="rc-key-input"/);
  assert.match(ui.html, /id="rc-key-save"/);
  assert.doesNotMatch(ui.html, /rc-key-change/);
  assert.match(ui.script, /\$\('rc-key-delete'\)\.hidden = s\.source !== 'staff-settings'/);
  // Prompts are not loaded at page load — only when the door is confirmed open.
  assert.match(ui.script, /loadRecipes\(\); loadKeyStatus\(\); loadBatches\(\);/);
  assert.doesNotMatch(ui.script, /loadRecipes\(\); loadKeyStatus\(\); loadBatches\(\); loadPrompts\(\);/);
  assert.match(ui.script, /rc-settings-confirm.*loadPrompts\(\)/s);
  assert.match(ui.script, /\$\('rc-settings-body'\)\.hidden = false/);
  // The reference lists are a closed <details>, not open text under the box.
  assert.match(ui.script, /el\('details', \{\}, \[/);
  assert.match(ui.script, /Show the KEEP \/ CHANGE ONLY \/ DO NOT lists/);
  assert.doesNotMatch(ui.script, /el\('details', \{[^}]*open/);
  // The editor still edits the exact prompt in the box and saves it verbatim.
  assert.match(ui.script, /ta\.value = p\.prompt/);
  assert.match(ui.script, /api\('savePrompt', \{ recipeId: p\.id, prompt: ta\.value \}\)/);
});

test('Select Model picker: segmented toggle, photo model cards, selected state, twilight disabled without a landscaped anchor', () => {
  const ui = require('../api/_recipes_ui');
  // A segmented Interior / Exterior toggle at the top of the panel, one
  // side active at a time; the grid is filtered by the active side.
  assert.match(ui.html, /id="rc-model-toggle"[^>]*aria-label="Interior or Exterior"/);
  assert.match(ui.html, /id="rc-seg-interior"[^>]*>Interior</);
  assert.match(ui.html, /id="rc-seg-exterior"[^>]*>Exterior</);
  assert.match(ui.script, /\$\('rc-seg-interior'\)\.addEventListener\('click', \(\) => setCategory\('interior'\)\)/);
  assert.match(ui.script, /\$\('rc-seg-exterior'\)\.addEventListener\('click', \(\) => setCategory\('exterior'\)\)/);
  assert.match(ui.script, /let pickedCategory = 'exterior';/);
  assert.match(ui.script, /recipes\.filter\(x => x\.category === pickedCategory\)/);
  // Exterior shows Lush Lawn + Twilight, Interior shows Farmhouse + Beach.
  assert.deepEqual(recipes.recipesByCategory('exterior').map(r => r.id), ['vl-lush-lawn-autumn', 'vt-virtual-twilight']);
  assert.deepEqual(recipes.recipesByCategory('interior').map(r => r.id), ['vs-modern-farmhouse-kitchen', 'mb-modern-beach-interior']);
  // Variant pills and one-line taglines, grounded in the locked recipes.
  for (const [id, variant, tagline] of [
    ['vl-lush-lawn-autumn', 'Autumn', 'Lush green lawn, five plantings, autumn trees'],
    ['vs-modern-farmhouse-kitchen', 'Farmhouse', 'Light wood table, grey sofa, cognac chairs'],
    ['vt-virtual-twilight', 'Dusk', 'Deep blue dusk, warm windows, porch lights'],
    ['mb-modern-beach-interior', 'Coastal', 'Linen sofa, rattan chairs, sea-blue cushions'],
  ]) {
    assert.match(ui.script, new RegExp(`'${id}': \\{ variant: '${variant}', tagline: '${tagline}' \\}`));
  }
  assert.match(ui.script, /class: 'rc-variant-pill', text: d\.variant/);
  // The selected card is unmistakable: outline, checkmark, Default pill.
  assert.match(ui.css, /\.rc-model-card\.rc-selected \{[^}]*border-color: var\(--rc-blue\)[^}]*box-shadow: 0 0 0 3px var\(--rc-blue\)/);
  // A real grid: three equal columns on a laptop, two on a tablet, one on a phone.
  assert.match(ui.css, /\.rc-model-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(ui.css, /@media \(max-width: 860px\) \{\s*\.rc-model-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(ui.css, /@media \(max-width: 560px\) \{[\s\S]*\.rc-model-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(ui.script, /class: 'rc-model-check', text: '✓'/);
  assert.match(ui.script, /class: 'rc-model-default', text: 'Default'/);
  assert.match(ui.script, /class: 'rc-model-card' \+ \(selected \? ' rc-selected' : ''\)/);
  // Coming soon: greyed-out divs in the grid, labelled, never a button.
  assert.match(ui.script, /class: 'rc-model-card rc-soon', 'aria-disabled': 'true'/);
  assert.match(ui.script, /text: 'Coming soon — not built yet'/);
  assert.doesNotMatch(ui.script, /rc-soon[^}]*onclick/);
  // Twilight gate in the picker: without the step 03 landscaped box
  // ticked, the card is shown disabled with the reason — never hidden,
  // never runnable. Unchecking the box clears a twilight pick.
  assert.match(ui.script, /function twilightBlocked\(recipeId\) \{\n    return recipeId === 'vt-virtual-twilight' && !\$\('rc-landscaped'\)\.checked;/);
  assert.match(ui.script, /class: 'rc-model-card rc-model-disabled', 'aria-disabled': 'true'/);
  assert.match(ui.script, /text: 'Needs approved landscaped photos first — tick the box in step 03\.'/);
  // Chain anchor, in the open: every model card says the first photo
  // sets the look and the rest are matched to it. No anchor to upload,
  // none shipped — the app makes it from the first photo.
  assert.match(ui.html, /Pick the look you want — the first photo sets it, the rest are matched to it\./);
  assert.match(ui.script, /class: 'rc-chain-note', text: 'First photo sets the look — the rest are matched to it\.'/);
  assert.doesNotMatch(ui.script, /no anchor photo/i);
  assert.match(ui.script, /\$\('rc-landscaped'\)\.addEventListener\('change', \(\) => \{/);
  assert.match(ui.script, /if \(\$\('rc-recipe'\)\.value === 'vt-virtual-twilight' && twilightBlocked\('vt-virtual-twilight'\)\) \{/);
  // The server still enforces the gate — the card is only the UI half.
  assert.match(ui.script, /if \(recipe\.id === 'vt-virtual-twilight' && !\$\('rc-landscaped'\)\.checked\)/);
  // Display strings only: the picker never rewrites a prompt or list.
  assert.doesNotMatch(ui.script, /MODEL_DISPLAY[^}]*prompt_chatgpt|keep:|change_only:|do_not:/);
});

test('Recipe Studio layout: full-width step panels, numbered steps 01–04, batch first, priced Run button, labelled results', () => {
  const ui = require('../api/_recipes_ui');
  // Steps stack full width (no narrow form column squeezing the model grid),
  // each with its own panel: tint, border and header colour tell them apart.
  assert.doesNotMatch(ui.css, /340px/);
  assert.match(ui.css, /\.rc-steps \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  const panelTints = new Set();
  for (const name of ['upload', 'model', 'run', 'review']) {
    const rule = ui.css.match(new RegExp(`\\.rc-panel-${name} \\{ --rc-tone: [^;]+; --rc-tint: ([^;]+); --rc-band: [^;]+; --rc-edge: [^;]+; \\}`));
    assert.ok(rule, `${name} panel sets its own colours`);
    panelTints.add(rule[1]);
    assert.ok(ui.html.includes(`rc-panel rc-panel-${name}`));
  }
  assert.equal(panelTints.size, 4);
  // Section titles are clearly bigger and bolder than body text.
  assert.match(ui.css, /\.rc-studio \.rc-step \{[^}]*font-size: 1\.4rem; font-weight: 800/);
  assert.ok(ui.html.indexOf('id="rc-results"') > ui.html.indexOf('id="rc-run"'));
  // Step 01 has no anchor upload at all — only the three angle tiles,
  // and the copy says the first photo sets the look.
  assert.doesNotMatch(ui.html, /rc-anchor/);
  assert.equal(ui.html.match(/class="rc-slot-input rc-angle" type="file"/g).length, 3);
  assert.match(ui.html, /Upload the photos that need fixing\./);
  assert.match(ui.html, /The first photo sets the look: it is edited first, and the rest are matched to it/);
  // [hidden] must keep working on restyled buttons (settings door, key delete).
  assert.match(ui.css, /\.rc-studio \[hidden\] \{ display: none !important; \}/);
  // The batch is the point, not one photo at a time — one line under the heading.
  assert.match(ui.html, /Batch first: one space, every angle together — same recipe, same prompt, one batch\. No one-photo-at-a-time\./);
  // Numbered steps in order: 01 Upload, 02 Select Model, 03 Run batch,
  // 04 Review & download. Upload comes before the style picker.
  for (const [num, label] of [['01', 'Upload'], ['02', 'Select Model'], ['03', 'Run batch'], ['04', 'Review']]) {
    assert.match(ui.html, new RegExp(`<span class="rc-step-num">${num}</span> ${label}`));
  }
  const order = ['>01<', '>02<', '>03<', '>04<'].map(t => ui.html.indexOf(t));
  assert.ok(order.every(i => i > -1) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3]);
  assert.ok(ui.html.indexOf('Angle 1') < ui.html.indexOf('id="rc-model-grid"'));
  // Step 02 is the Select Model grid (see the picker test below): a
  // segmented Interior / Exterior toggle filtering photo model cards —
  // no dropdown, no two-step back-and-forth.
  assert.match(ui.html, /Select Model/);
  assert.match(ui.script, /rc-model-grid/);
  assert.match(ui.html, /rc-model-toggle/);
  assert.doesNotMatch(ui.script, /rc-pick-category|rc-style-cards|rc-pick-back/);
  assert.doesNotMatch(ui.html, /<select[^>]*rc-recipe/);
  // No price on the Run buttons — the Studio is staff-only and the team
  // already knows the rate. The buttons are plain labels at any angle count.
  assert.match(ui.html, /id="rc-run" type="button">Run batch<\//);
  assert.match(ui.html, /id="rc-test-one" type="button">Test one angle first<\//);
  assert.match(ui.html, /You confirm before anything is sent\./);
  assert.doesNotMatch(ui.html, /\$35/);
  assert.doesNotMatch(ui.script, /\$35|PRICE_PER_PHOTO|price_anchor|updateRunLabel/);
  // Results accumulate in step 04 instead of replacing each other, each card
  // a Before/After pair labelled with space, style badge and run time.
  assert.match(ui.script, /let runs = \[\];/);
  assert.match(ui.script, /runs\.unshift\(\{ batchId: out\.batchId, images, results: out\.results, space:.*recipeName: recipe\.name, ranAt: new Date\(\)\.toISOString\(\) \}\)/);
  assert.doesNotMatch(ui.script, /lastRun/);
  assert.match(ui.script, /class: 'rc-results-grid'/);
  assert.match(ui.script, /class: 'rc-result-card'/);
  assert.match(ui.script, /class: 'rc-shot'/);
  assert.match(ui.script, /class: 'rc-badge', text: 'Before'/);
  assert.match(ui.script, /class: 'rc-badge after', text: 'After'/);
  assert.match(ui.script, /class: 'rc-style-badge', text: entry\.recipeName/);
  assert.match(ui.script, /class: 'rc-result-meta'/);
  // Per-card Approve control and per-run Save stay as they were.
  assert.match(ui.script, /Approve this angle/);
  assert.match(ui.script, /text: 'Save approved set'/);
  // Listing Pixl's own palette: teal, hot pink, electric blue. No orange
  // (including the old amber warning colours), no purple/magenta theme.
  assert.match(ui.css, /--rc-teal: var\(--accent, #0c7a8c\); --rc-pink: var\(--accent-pink, #d71266\); --rc-blue: #007fff/);
  assert.match(ui.css, /\.rc-step-num \{[^}]*background: var\(--rc-tone\)/);
  assert.match(ui.css, /\.rc-style-badge \{[^}]*background: var\(--rc-blue-deep\)/);
  assert.doesNotMatch(ui.css, /orange|#f97316|#ff6b35|purple|#7c3aed|#a855f7|magenta|#fff7e0|#7a4d00/i);
  assert.match(ui.html, /class="rc-btn pink" id="rc-run"/);
});
