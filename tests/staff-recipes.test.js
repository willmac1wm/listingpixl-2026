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
    assert.deepEqual(sentPrompts, ['Edited lawn prompt — lawn is the hero']);

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
    assert.deepEqual(sentPrompts, [recipes.getRecipe('vl-lush-lawn-autumn').prompt_chatgpt]);
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
    { name: 'anchor.jpg', mime: 'image/jpeg', bytes: 100 },
    { name: 'angle.jpg', mime: 'image/jpeg', bytes: 100 },
  ]));
});

test('a plain browser visit to /staff/recipes redirects to the Recipe Studio section, never a JSON error', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const authed = response();
    await handler({ method: 'GET', url: '/staff/recipes', headers: headers({ authorization: basic() }) }, authed);
    assert.equal(authed.statusCode, 302);
    assert.equal(authed.getHeader('location'), '/staff#recipe-studio');
    assert.doesNotMatch(authed.body, /Unknown action/);

    // Same for a visitor who is not signed in yet — /staff sends them to
    // the login page; they never see a JSON error either.
    const anon = response();
    await handler({ method: 'GET', url: '/staff/recipes', headers: headers() }, anon);
    assert.equal(anon.statusCode, 302);
    assert.equal(anon.getHeader('location'), '/staff#recipe-studio');

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

test('key form only shows what can be done, and the prompt reference lists sit behind a closed toggle', () => {
  const ui = require('../api/_recipes_ui');
  // A "Change key" control exists; the field and both buttons start
  // hidden and are only revealed by the status check or the link.
  assert.match(ui.html, /id="rc-key-change"/);
  assert.match(ui.html, /Change key/);
  assert.match(ui.html, /id="rc-key-input"[^>]*hidden/);
  assert.match(ui.html, /id="rc-key-save"[^>]*hidden/);
  assert.match(ui.html, /id="rc-key-delete"[^>]*hidden/);
  // The client shows the field + Save only with no key, shows Remove
  // only for a Blob-saved key, and shows Change key when one is set.
  assert.match(ui.script, /\$\('rc-key-delete'\)\.hidden = s\.source !== 'staff-settings'/);
  assert.match(ui.script, /\$\('rc-key-change'\)\.hidden = !s\.configured/);
  assert.match(ui.script, /rc-key-change.*addEventListener\('click'/s);
  // The reference lists are a closed <details>, not open text under the box.
  assert.match(ui.script, /el\('details', \{\}, \[/);
  assert.match(ui.script, /Show the KEEP \/ CHANGE ONLY \/ DO NOT lists/);
  assert.doesNotMatch(ui.script, /el\('details', \{[^}]*open/);
  // The editor still edits the exact prompt in the box and saves it verbatim.
  assert.match(ui.script, /ta\.value = p\.prompt/);
  assert.match(ui.script, /api\('savePrompt', \{ recipeId: p\.id, prompt: ta\.value \}\)/);
});
