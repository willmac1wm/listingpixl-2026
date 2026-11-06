// Recipe Studio panel on the team dashboard (/staff). Plain browser JS;
// every value from the API is put on the page as text, never as HTML.
//
// Flow: pick a recipe (from data/recipes.json via the API) → upload an
// anchor + up to 3 angles of the SAME space → run as one batch (same prompt
// + same anchor for every angle; the API makes one call per angle because
// OpenAI returns one image per call) → preview each angle side by side
// with its original → approve per angle → approved set is saved to public
// Blob and becomes the new anchor for that space.
//
// Originals are never uploaded at full size and never overwritten: the
// browser downscales working copies to 1536px for the API call. The
// full-res originals stay with William / in HD Photo Hub.
// Twilight is gated: it only runs on an approved Virtually-Landscaped
// anchor — landscape first, twilight second.
const css = `
    .rc-box { border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); padding: 1rem 1.1rem; margin: 0.75rem 0; }
    .rc-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .rc-box select, .rc-box input, .rc-box textarea { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid #cfc8b8; border-radius: 8px; background: #fff; color: #1d1d1d; max-width: 100%; }
    .rc-box select { flex: 1 1 320px; }
    .rc-box label { font-size: 0.9rem; }
    .rc-btn { font: inherit; border: 0; border-radius: 999px; padding: 0.5rem 1.1rem; cursor: pointer; background: #1d1d1d; color: #fff; }
    .rc-btn.pink { background: var(--accent-pink, #d63384); }
    .rc-btn.ghost { background: transparent; color: #1d1d1d; border: 1px solid #cfc8b8; }
    .rc-btn:disabled { opacity: 0.5; cursor: wait; }
    .rc-msg { font-size: 0.9rem; color: var(--muted, #555); margin: 0.4rem 0 0; }
    .rc-err { color: #b00020; }
    .rc-warn { background: #fff7e0; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.9rem; margin: 0.5rem 0; }
    .rc-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }
    .rc-compare figure { margin: 0; }
    .rc-compare img { width: 100%; height: auto; border-radius: 8px; display: block; }
    .rc-compare figcaption { font-size: 0.85rem; color: var(--muted, #666); margin-top: 0.25rem; }
    .rc-qc { font-size: 0.9rem; color: var(--muted, #555); padding-left: 1.2rem; }
    .rc-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 0.5rem 0; }
    .rc-pick-btn, .rc-card { font: inherit; text-align: left; border: 2px solid #cfc8b8; border-radius: 12px; background: #fff; color: #1d1d1d; padding: 0; cursor: pointer; overflow: hidden; }
    .rc-pick-btn img, .rc-card img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .rc-pick-btn span, .rc-card span { display: block; padding: 0.55rem 0.75rem; }
    .rc-pick-btn b, .rc-card b { display: block; font-size: 1rem; }
    .rc-pick-btn small, .rc-card small { display: block; font-size: 0.85rem; color: var(--muted, #555); margin-top: 0.2rem; }
    .rc-pick-btn:hover, .rc-card:hover { border-color: var(--accent-pink, #d63384); }
    .rc-pick-btn.rc-selected, .rc-card.rc-selected { border-color: var(--accent-pink, #d63384); box-shadow: 0 0 0 2px var(--accent-pink, #d63384); }
    .rc-card.rc-soon { opacity: 0.55; cursor: not-allowed; background: #f4f1ea; border-style: dashed; }
    .rc-card.rc-soon:hover { border-color: #cfc8b8; }
    .rc-step { font-size: 0.9rem; font-weight: 700; margin: 0.5rem 0 0; }
`;

const html = `
    <section class="dash-section" id="recipe-studio">
      <h2>Recipe Studio — batch edits, one space at a time</h2>
      <div class="rc-box">
        <p class="rc-msg" id="rc-key-status" role="status">Checking the image API key…</p>
        <div class="rc-row" id="rc-key-form">
          <input id="rc-key-input" type="password" placeholder="OpenAI API key (sk-…)" autocomplete="off" aria-label="OpenAI API key" style="flex:1 1 280px">
          <button class="rc-btn" id="rc-key-save" type="button">Save key</button>
          <button class="rc-btn ghost" id="rc-key-delete" type="button">Remove saved key</button>
        </div>
        <p class="rc-msg">The key is never shown again and never leaves the server. Best place for it is the OPENAI_API_KEY variable in Vercel — this form is the fallback. No key = no batch runs, no spend.</p>
      </div>
      <div class="rc-box">
        <p class="rc-step">Step 1 — Interior or Exterior?</p>
        <div class="rc-pick" id="rc-pick-category"><p class="rc-msg">Loading recipes…</p></div>
        <div id="rc-pick-styles" hidden>
          <p class="rc-step" id="rc-step2-title">Step 2 — pick a style</p>
          <div class="rc-pick" id="rc-style-cards"></div>
          <button class="rc-btn ghost" id="rc-pick-back" type="button">← Back to Interior / Exterior</button>
        </div>
        <input type="hidden" id="rc-recipe" value="">
        <div class="rc-row" style="margin-top:.5rem">
          <input id="rc-shoot" placeholder="Shoot slug, e.g. 114-e-anna-st-whitesboro-nj" aria-label="Shoot slug" style="flex:1 1 280px">
          <input id="rc-space" placeholder="Space, e.g. front yard" aria-label="Space" style="flex:1 1 160px">
        </div>
        <p class="rc-msg" id="rc-recipe-note"></p>
        <div class="rc-row" style="margin-top:.5rem">
          <label>Anchor (finished look)<br><input id="rc-anchor" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 2<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 3<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 4<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
        </div>
        <p class="rc-msg">Working copies are downscaled in your browser to 1536px for the API call. Full-res originals stay where they are — nothing here overwrites them. Edited files get -Virtually-Staged / -Virtually-Landscaped / -Virtually-Landscaped-Twilight in the name.</p>
        <label><input type="checkbox" id="rc-landscaped"> This anchor is an approved Virtually-Landscaped image (required for twilight — landscape first, twilight second)</label>
        <div class="rc-row" style="margin-top:.5rem">
          <button class="rc-btn ghost" id="rc-test-one" type="button">Test one angle first</button>
          <button class="rc-btn pink" id="rc-run" type="button">Run full batch</button>
        </div>
        <p class="rc-msg" id="rc-status" role="status"></p>
        <p class="rc-msg rc-err" id="rc-error" role="alert"></p>
      </div>
      <div id="rc-results"></div>
      <div class="rc-box"><h3 style="margin-top:0">Recent batches</h3><div id="rc-batches"><p class="rc-msg">Loading…</p></div></div>
    </section>
`;

function client() {
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  async function api(action, body) {
    const r = await fetch(location.origin + '/staff/recipes?action=' + action, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify(body),
    } : {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  const err = e => { const n = $('rc-error'); n.textContent = e.message; };
  const status = t => { $('rc-status').textContent = t; $('rc-error').textContent = ''; };

  let recipes = [];
  let plannedStyles = [];
  let pickedCategory = null;
  // Step 1 photo: a real photo from the tests — the first live recipe in
  // that category (kitchen for Interior, lush lawn for Exterior).
  function categoryPhoto(category) {
    const r = recipes.find(x => x.category === category && x.button_image);
    return r ? r.button_image : null;
  }
  function renderCategoryStep() {
    const box = $('rc-pick-category');
    box.replaceChildren();
    for (const category of ['interior', 'exterior']) {
      const photo = categoryPhoto(category);
      const label = category === 'interior' ? 'Interior' : 'Exterior';
      const caption = category === 'interior' ? 'Staging inside the house' : 'Landscaping and twilight outside the house';
      box.append(el('button', {
        type: 'button',
        class: 'rc-pick-btn' + (pickedCategory === category ? ' rc-selected' : ''),
        'aria-pressed': pickedCategory === category ? 'true' : 'false',
        onclick: () => pickCategory(category),
      }, [
        photo ? el('img', { src: photo, alt: label + ' — example photo' }) : null,
        el('span', {}, [el('b', { text: label }), el('small', { text: caption })]),
      ]));
    }
  }
  function pickCategory(category) {
    pickedCategory = category;
    $('rc-recipe').value = '';
    $('rc-recipe-note').textContent = '';
    $('rc-pick-styles').hidden = false;
    $('rc-step2-title').textContent = 'Step 2 — pick a ' + category + ' style';
    renderCategoryStep();
    renderStyleCards();
  }
  function renderStyleCards() {
    const box = $('rc-style-cards');
    box.replaceChildren();
    for (const r of recipes.filter(x => x.category === pickedCategory)) {
      box.append(el('button', {
        type: 'button',
        class: 'rc-card' + ($('rc-recipe').value === r.id ? ' rc-selected' : ''),
        'aria-pressed': $('rc-recipe').value === r.id ? 'true' : 'false',
        onclick: () => pickRecipe(r.id),
      }, [
        r.button_image ? el('img', { src: r.button_image, alt: r.name }) : null,
        el('span', {}, [el('b', { text: r.name }), el('small', { text: r.price_anchor })]),
      ]));
    }
    // Coming soon: a name only — no photo, no recipe, no prompt behind it.
    // A plain div, never a button, so it cannot be selected or run.
    for (const s of plannedStyles.filter(s => s.category === pickedCategory)) {
      box.append(el('div', { class: 'rc-card rc-soon', 'aria-disabled': 'true' }, [
        el('span', {}, [el('b', { text: s.name }), el('small', { text: 'Coming soon — not built yet' })]),
      ]));
    }
  }
  function pickRecipe(id) {
    $('rc-recipe').value = id;
    renderStyleCards();
    showRecipeNote();
  }
  $('rc-pick-back').addEventListener('click', () => {
    pickedCategory = null;
    $('rc-recipe').value = '';
    $('rc-recipe-note').textContent = '';
    $('rc-pick-styles').hidden = true;
    renderCategoryStep();
  });
  async function loadRecipes() {
    try {
      const data = await api('recipes');
      recipes = data.recipes || [];
      plannedStyles = data.plannedStyles || [];
      renderCategoryStep();
    } catch (e) { $('rc-pick-category').replaceChildren(el('p', { class: 'rc-msg rc-err', text: 'Could not load recipes: ' + e.message })); err(e); }
  }
  function showRecipeNote() {
    const r = recipes.find(x => x.id === $('rc-recipe').value);
    if (!r) return;
    $('rc-recipe-note').textContent = `${r.use_when} Anchor: ${r.anchor}`;
    const box = el('div', {});
    box.append(el('p', { class: 'rc-msg', text: 'QC — check the set side by side:' }));
    const ul = el('ul', { class: 'rc-qc' });
    r.qc_checklist.forEach(q => ul.append(el('li', { text: q })));
    box.append(ul);
    const old = $('rc-recipe-note').nextElementSibling;
    $('rc-recipe-note').after(box);
    if (old && old.tagName === 'DIV' && old.querySelector('.rc-qc')) old.remove();
  }
  // (Recipe selection calls showRecipeNote() directly — the picker sets
  // the hidden #rc-recipe value, it is not a user-changed select.)

  async function loadKeyStatus() {
    try {
      const s = await api('settingsStatus');
      $('rc-key-status').textContent = s.configured
        ? `Image API key: configured (${s.source === 'env' ? 'Vercel environment' : 'saved in Staff Settings'}). It is never shown.`
        : 'Image API key: NOT configured — batch runs are disabled until a key is saved.';
      $('rc-run').disabled = !s.configured;
      $('rc-test-one').disabled = !s.configured;
    } catch (e) { $('rc-key-status').textContent = 'Could not check the key status: ' + e.message; }
  }
  $('rc-key-save').addEventListener('click', async () => {
    const key = $('rc-key-input').value.trim();
    if (!key) return err(new Error('Paste the key first.'));
    try { await api('saveKey', { key }); $('rc-key-input').value = ''; status('Key saved. It will not be shown again.'); loadKeyStatus(); }
    catch (e) { err(e); }
  });
  $('rc-key-delete').addEventListener('click', async () => {
    if (!confirm('Remove the saved key? Batch runs stop until a key is set again.')) return;
    try { await api('deleteKey', {}); status('Saved key removed.'); loadKeyStatus(); } catch (e) { err(e); }
  });

  // Downscale in the browser so the API call stays small and fast.
  function downscale(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1536 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve({ name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.88) });
      };
      img.onerror = () => reject(new Error(file.name + ' could not be read as an image.'));
      img.src = URL.createObjectURL(file);
    });
  }
  async function collectImages() {
    const anchorFile = $('rc-anchor').files[0];
    if (!anchorFile) throw new Error('Pick an anchor image first.');
    const angles = [...document.querySelectorAll('.rc-angle')].map(i => i.files[0]).filter(Boolean);
    if (!angles.length) throw new Error('Pick at least one angle of the same space.');
    return [await downscale(anchorFile), ...await Promise.all(angles.map(downscale))];
  }

  let lastRun = null;
  async function run(onlyFirst) {
    const recipe = recipes.find(x => x.id === $('rc-recipe').value);
    if (!recipe) return err(new Error('Pick a recipe first.'));
    if (recipe.id === 'vt-virtual-twilight' && !$('rc-landscaped').checked) {
      return err(new Error('Twilight runs only on an approved Virtually-Landscaped image. Tick the box only if the anchor is one — landscape first, twilight second.'));
    }
    const count = [...document.querySelectorAll('.rc-angle')].map(i => i.files[0]).filter(Boolean).length;
    const costNote = `This sends ${onlyFirst ? 1 : count} paid OpenAI image call${(onlyFirst ? 1 : count) === 1 ? '' : 's'} (${recipe.price_anchor} per edited photo). Run it?`;
    if (!confirm(costNote)) return;
    try {
      status(onlyFirst ? 'Running one angle…' : 'Running the batch — one API call per angle, same prompt and anchor…');
      const images = await collectImages();
      const out = await api('runBatch', {
        recipeId: recipe.id, shootSlug: $('rc-shoot').value.trim(), space: $('rc-space').value.trim() || 'space',
        landscapedApproved: $('rc-landscaped').checked, onlyFirst, images,
      });
      lastRun = { batchId: out.batchId, images, results: out.results };
      status(`Done — ${out.results.length} angle${out.results.length === 1 ? '' : 's'} edited with ${out.model}. Check each one below, then save the ones you approve.`);
      renderResults();
      loadBatches();
    } catch (e) { err(e); status(''); }
  }
  $('rc-test-one').addEventListener('click', () => run(true));
  $('rc-run').addEventListener('click', () => run(false));

  function renderResults() {
    const box = $('rc-results');
    box.replaceChildren();
    if (!lastRun) return;
    const originals = {};
    lastRun.images.forEach(i => { originals[i.name] = i.dataUrl; });
    lastRun.results.forEach(r => {
      const cb = el('input', { type: 'checkbox', 'aria-label': 'Approve ' + r.angleName });
      cb.checked = true;
      cb.setAttribute('data-angle', r.angleName);
      const card = el('div', { class: 'rc-box' }, [
        el('h3', { text: r.angleName + ' → ' + r.editedFilename }),
        el('div', { class: 'rc-compare' }, [
          el('figure', {}, [el('img', { src: originals[r.angleName], alt: 'Original: ' + r.angleName }), el('figcaption', { text: 'Original' })]),
          el('figure', {}, [el('img', { src: r.dataUrl, alt: 'Edited: ' + r.angleName }), el('figcaption', { text: 'Edited — ' + r.editedFilename })]),
        ]),
        el('label', {}, [cb, el('span', { text: ' Approve this angle' })]),
      ]);
      box.append(card);
    });
    const save = el('button', { class: 'rc-btn pink', type: 'button', text: 'Save approved set' });
    const msg = el('p', { class: 'rc-msg', role: 'status' });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const approvals = lastRun.results.filter(x => box.querySelector(`input[data-angle="${CSS.escape(x.angleName)}"]`).checked)
          .map(x => ({ angleName: x.angleName, dataUrl: x.dataUrl }));
        if (!approvals.length) throw new Error('Approve at least one angle.');
        const out = await api('approve', { batchId: lastRun.batchId, approvals });
        msg.textContent = `Saved ${out.saved.length} approved file${out.saved.length === 1 ? '' : 's'}. The approved set is now the anchor for this space.`;
        const slug = $('rc-shoot').value.trim();
        if (slug) {
          for (const f of out.saved) {
            await fetch(location.origin + '/staff/delivery?action=addFile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify({ slug, url: f.url, filename: f.filename }) }).catch(() => {});
          }
          msg.textContent += ' Added to the delivery shoot record.';
        }
        loadBatches();
      } catch (e) { msg.textContent = e.message; msg.classList.add('rc-err'); save.disabled = false; }
    });
    box.append(el('div', { class: 'rc-box' }, [save, msg]));
  }

  async function loadBatches() {
    try {
      const list = await api('batches');
      $('rc-batches').replaceChildren(...(list.length ? list.map(b => el('p', { class: 'rc-msg', text: `${b.space} · ${b.recipeId} · ${b.status} · ${new Date(b.createdAt).toLocaleString()}${b.approvedFiles ? ' · ' + b.approvedFiles.length + ' approved' : ''}` })) : [el('p', { class: 'rc-msg', text: 'No batches yet.' })]));
    } catch (e) { $('rc-batches').replaceChildren(el('p', { class: 'rc-msg rc-err', text: 'Loading batches failed: ' + e.message })); }
  }

  loadRecipes(); loadKeyStatus(); loadBatches();
}

module.exports = { css, html, script: `(${client.toString()})();` };
