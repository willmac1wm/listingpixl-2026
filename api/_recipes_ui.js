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
    .rc-step-num { display: inline-block; min-width: 2rem; text-align: center; font-weight: 700; color: #fff; background: var(--accent, #0c7a8c); border-radius: 999px; padding: 0.1rem 0.45rem; margin-right: 0.4rem; }
    .rc-layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 1rem; align-items: start; }
    @media (max-width: 900px) { .rc-layout { grid-template-columns: 1fr; } }
    .rc-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; margin: 0.5rem 0; }
    .rc-result-card { border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); padding: 0.75rem; }
    .rc-result-card h3 { margin: 0 0 0.5rem; font-size: 0.95rem; overflow-wrap: anywhere; }
    .rc-shot { position: relative; }
    .rc-badge { position: absolute; top: 0.4rem; left: 0.4rem; background: #1d1d1d; color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; }
    .rc-badge.after { background: var(--accent, #0c7a8c); }
    .rc-result-meta { font-size: 0.85rem; color: var(--muted, #555); margin: 0.5rem 0; }
    .rc-style-badge { background: #007fff; color: #fff; font-weight: 700; font-size: 0.8rem; padding: 0.1rem 0.55rem; border-radius: 999px; }
    .rc-run-head { font-size: 0.9rem; font-weight: 700; margin: 0.5rem 0 0; }
    .rc-run + .rc-run { border-top: 1px solid var(--card-border, #e5e0d5); margin-top: 0.75rem; padding-top: 0.5rem; }
    .rc-prompt-card { display: flex; gap: 0.75rem; align-items: flex-start; border: 1px solid #cfc8b8; border-radius: 12px; padding: 0.75rem; margin: 0.5rem 0; background: #fff; }
    .rc-prompt-card img { width: 120px; height: 80px; object-fit: cover; border-radius: 8px; flex: none; }
    .rc-prompt-card .rc-prompt-body { flex: 1 1 auto; min-width: 0; }
    .rc-prompt-card b { display: block; font-size: 1rem; }
    .rc-prompt-status { font-size: 0.9rem; margin: 0.2rem 0 0.5rem; }
    .rc-prompt-status.rc-edited { color: #7a4d00; font-weight: 700; }
    .rc-prompt-editor textarea { width: 100%; min-height: 220px; font: inherit; font-size: 0.9rem; line-height: 1.45; }
    .rc-prompt-editor details { margin: 0.5rem 0; }
    .rc-prompt-editor summary { cursor: pointer; font-size: 0.9rem; color: var(--muted, #555); }
    #rc-settings-door { margin: 0.75rem 0; }
    #rc-settings-warning { margin-top: 0.5rem; }
    #rc-settings-body { margin-top: 0.5rem; }
    .rc-prompt-lists { font-size: 0.9rem; color: var(--muted, #555); padding-left: 1.2rem; }
    .rc-prompt-lists h4 { margin: 0.6rem 0 0.2rem; font-size: 0.9rem; color: #1d1d1d; }
`;

const html = `
    <section class="dash-section" id="recipe-studio">
      <h2>Recipe Studio — batch edits, one space at a time</h2>
      <p class="rc-msg">Batch first: one space, every angle together — same anchor, same prompt, one batch. No one-photo-at-a-time.</p>
      <p class="rc-msg" id="rc-key-status" role="status">Checking the image API key…</p>
      <div class="rc-layout">
        <div class="rc-controls">
      <div id="rc-settings-door">
        <button class="rc-btn ghost" id="rc-settings-open" type="button">Recipe settings — advanced</button>
        <div id="rc-settings-warning" hidden>
          <p class="rc-warn">These settings affect other things. Changing a prompt changes every future batch that uses that recipe. Changing or removing the key stops batch runs until a key is set again.</p>
          <div class="rc-row">
            <button class="rc-btn pink" id="rc-settings-confirm" type="button">I understand, open settings</button>
            <button class="rc-btn ghost" id="rc-settings-cancel" type="button">Not now</button>
          </div>
        </div>
        <div id="rc-settings-body" hidden>
          <div class="rc-box" id="rc-prompts-box">
            <h3 style="margin-top:0">Recipe prompts — see and edit the exact prompt each recipe runs</h3>
            <p class="rc-msg">Every batch runs the prompt shown here, word for word. Pick a recipe below, press <b>Edit prompt</b>, change the wording, and save — the next batch runs your edited version. Nothing here changes the original photos.</p>
            <p class="rc-msg">Pack default: <b>data/recipes.json</b> in the site repo (and <b>~/workspace/listing-pixl-recipes/recipes.json</b> in the recipe pack). Editing here overrides it in this portal only — it does <b>not</b> change the pack files. Press <b>Reset to pack default</b> any time to go back to the pack wording.</p>
            <div id="rc-prompt-cards"><p class="rc-msg">Loading prompts…</p></div>
          </div>
          <div class="rc-box">
            <div class="rc-row" id="rc-key-form">
              <input id="rc-key-input" type="password" placeholder="OpenAI API key (sk-…)" autocomplete="off" aria-label="OpenAI API key" style="flex:1 1 280px">
              <button class="rc-btn" id="rc-key-save" type="button">Save key</button>
              <button class="rc-btn ghost" id="rc-key-delete" type="button" hidden>Remove saved key</button>
            </div>
            <p class="rc-msg">The key is never shown again and never leaves the server. Best place for it is the OPENAI_API_KEY variable in Vercel — this form is the fallback. No key = no batch runs, no spend.</p>
          </div>
          <button class="rc-btn ghost" id="rc-settings-close" type="button" hidden>Close settings</button>
        </div>
      </div>
      <div class="rc-box">
        <p class="rc-step"><span class="rc-step-num">01</span> Upload — anchor + angles of the same space</p>
        <div class="rc-row" style="margin-top:.5rem">
          <input id="rc-shoot" placeholder="Shoot slug, e.g. 114-e-anna-st-whitesboro-nj" aria-label="Shoot slug" style="flex:1 1 280px">
          <input id="rc-space" placeholder="Space, e.g. front yard" aria-label="Space" style="flex:1 1 160px">
        </div>
        <div class="rc-row" style="margin-top:.5rem">
          <label>Anchor (finished look)<br><input id="rc-anchor" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 2<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 3<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label>Angle 4<br><input class="rc-angle" type="file" accept="image/jpeg,image/png,image/webp"></label>
        </div>
        <p class="rc-msg">Working copies are downscaled in your browser to 1536px for the API call. Full-res originals stay where they are — nothing here overwrites them. Edited files get -Virtually-Staged / -Virtually-Landscaped / -Virtually-Landscaped-Twilight in the name.</p>
        <p class="rc-step"><span class="rc-step-num">02</span> Choose style</p>
        <div class="rc-pick" id="rc-pick-category"><p class="rc-msg">Loading recipes…</p></div>
        <div id="rc-pick-styles" hidden>
          <p class="rc-msg" id="rc-step2-title">Pick a style</p>
          <div class="rc-pick" id="rc-style-cards"></div>
          <button class="rc-btn ghost" id="rc-pick-back" type="button">← Back to Interior / Exterior</button>
        </div>
        <input type="hidden" id="rc-recipe" value="">
        <p class="rc-msg" id="rc-recipe-note"></p>
        <p class="rc-step"><span class="rc-step-num">03</span> Run batch</p>
        <label><input type="checkbox" id="rc-landscaped"> This anchor is an approved Virtually-Landscaped image (required for twilight — landscape first, twilight second)</label>
        <div class="rc-row" style="margin-top:.5rem">
          <button class="rc-btn ghost" id="rc-test-one" type="button">Test one angle first — $35</button>
          <button class="rc-btn pink" id="rc-run" type="button">Run batch — $35 per photo</button>
        </div>
        <p class="rc-msg" id="rc-status" role="status"></p>
        <p class="rc-msg rc-err" id="rc-error" role="alert"></p>
      </div>
        </div>
        <div class="rc-results-col">
          <div class="rc-box">
            <p class="rc-step"><span class="rc-step-num">04</span> Review &amp; download</p>
            <div id="rc-results"><p class="rc-msg">No results yet — run a batch and each angle appears here, beside the form.</p></div>
          </div>
          <div class="rc-box"><h3 style="margin-top:0">Recent batches</h3><div id="rc-batches"><p class="rc-msg">Loading…</p></div></div>
        </div>
      </div>
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
  // Step 02 photo: a real photo from the tests — the first live recipe in
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
    $('rc-step2-title').textContent = 'Pick a ' + category + ' style';
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

  // --- Recipe prompts: see and edit the exact prompt each recipe runs ---
  let promptCards = [];
  let plannedPromptStyles = [];
  let editingPromptId = null;
  function promptStatusText(p) {
    return p.source === 'override' && p.updatedAt
      ? 'Using your edited prompt — saved ' + new Date(p.updatedAt).toLocaleString()
      : 'Using pack default prompt';
  }
  function renderPromptCards() {
    const box = $('rc-prompt-cards');
    box.replaceChildren();
    for (const p of promptCards) {
      const body = el('div', { class: 'rc-prompt-body' }, [
        el('b', { text: p.name + ' — ' + p.category }),
        el('p', { class: 'rc-prompt-status' + (p.source === 'override' ? ' rc-edited' : ''), text: promptStatusText(p) }),
      ]);
      const card = el('div', { class: 'rc-prompt-card' }, [
        p.button_image ? el('img', { src: p.button_image, alt: p.name }) : null,
        body,
      ]);
      if (editingPromptId === p.id) {
        const ta = el('textarea', { rows: '12', 'aria-label': 'Prompt for ' + p.name });
        ta.value = p.prompt;
        // The reference lists repeat what the prompt above already says in
        // prose — keep them behind a closed toggle so the editor does not
        // read as if the prompt is written out twice. The box itself and
        // what Save stores are unchanged.
        const listsInner = el('div', {}, []);
        for (const [title, items] of [['KEEP — do not change', p.keep], ['CHANGE ONLY', p.change_only], ['DO NOT', p.do_not]]) {
          listsInner.append(el('h4', { text: title }));
          const ul = el('ul', { class: 'rc-prompt-lists' });
          (items || []).forEach(t => ul.append(el('li', { text: t })));
          listsInner.append(ul);
        }
        const lists = el('details', {}, [
          el('summary', { text: 'Show the KEEP / CHANGE ONLY / DO NOT lists' }),
          listsInner,
        ]);
        const msg = el('p', { class: 'rc-msg', role: 'status' });
        const save = el('button', { class: 'rc-btn pink', type: 'button', text: 'Save prompt' });
        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            const out = await api('savePrompt', { recipeId: p.id, prompt: ta.value });
            msg.textContent = 'Saved — batches now run your edited prompt (saved ' + new Date(out.updatedAt).toLocaleString() + ').';
            editingPromptId = null;
            await loadPrompts();
          } catch (e) { msg.textContent = e.message; msg.classList.add('rc-err'); save.disabled = false; }
        });
        const reset = el('button', { class: 'rc-btn ghost', type: 'button', text: 'Reset to pack default' });
        reset.addEventListener('click', async () => {
          if (!confirm('Throw away your edited prompt for ' + p.name + ' and go back to the pack wording?')) return;
          try { await api('resetPrompt', { recipeId: p.id }); editingPromptId = null; await loadPrompts(); }
          catch (e) { msg.textContent = e.message; msg.classList.add('rc-err'); }
        });
        const cancel = el('button', { class: 'rc-btn ghost', type: 'button', text: 'Cancel' });
        cancel.addEventListener('click', () => { editingPromptId = null; renderPromptCards(); });
        body.append(
          el('div', { class: 'rc-prompt-editor' }, [
            el('p', { class: 'rc-msg', text: 'This is the exact prompt the next batch will run, word for word. Edit it, then save.' }),
            ta, lists,
            el('div', { class: 'rc-row' }, [save, reset, cancel]),
            msg,
          ]),
        );
      } else {
        body.append(el('button', {
          class: 'rc-btn', type: 'button', text: 'Edit prompt',
          onclick: () => { editingPromptId = p.id; renderPromptCards(); },
        }));
      }
      box.append(card);
    }
    // Coming soon: no prompt exists yet, so there is nothing to edit.
    // Plain text, no button — same as the picker, they cannot be run.
    for (const s of plannedPromptStyles) {
      box.append(el('div', { class: 'rc-prompt-card' }, [
        el('div', { class: 'rc-prompt-body' }, [
          el('b', { text: s.name + ' — ' + s.category }),
          el('p', { class: 'rc-prompt-status', text: 'No prompt yet — this style isn\'t built yet.' }),
        ]),
      ]));
    }
  }
  async function loadPrompts() {
    try {
      const data = await api('prompts');
      promptCards = data.prompts || [];
      plannedPromptStyles = data.plannedStyles || [];
      renderPromptCards();
    } catch (e) { $('rc-prompt-cards').replaceChildren(el('p', { class: 'rc-msg rc-err', text: 'Could not load prompts: ' + e.message })); }
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
      // "Remove saved key" only removes the Blob-saved fallback key; it
      // cannot remove the env var key, so it only appears for that case.
      // The input and Save live behind the settings door, so they are
      // always shown there — the door is the gate, not the form.
      $('rc-key-delete').hidden = s.source !== 'staff-settings';
      $('rc-run').disabled = !s.configured;
      $('rc-test-one').disabled = !s.configured;
    } catch (e) {
      $('rc-key-status').textContent = 'Could not check the key status: ' + e.message;
      $('rc-key-delete').hidden = true;
    }
  }

  // --- Recipe settings: a closed door, opened only on purpose ---
  // Prompts and key controls live behind it. Opening first shows a
  // warning and needs an explicit confirm; prompts are only loaded
  // once the door is opened, so nothing behind it is on the page
  // before then.
  $('rc-settings-open').addEventListener('click', () => {
    $('rc-settings-open').hidden = true;
    $('rc-settings-warning').hidden = false;
  });
  $('rc-settings-cancel').addEventListener('click', () => {
    $('rc-settings-warning').hidden = true;
    $('rc-settings-open').hidden = false;
  });
  $('rc-settings-confirm').addEventListener('click', () => {
    $('rc-settings-warning').hidden = true;
    $('rc-settings-body').hidden = false;
    $('rc-settings-close').hidden = false;
    loadPrompts();
  });
  $('rc-settings-close').addEventListener('click', () => {
    $('rc-settings-body').hidden = true;
    $('rc-settings-close').hidden = true;
    $('rc-settings-open').hidden = false;
  });
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

  // $35 per edited photo — Listing Pixl pricing for staging, landscape
  // and twilight alike. The Run button always shows the batch total so
  // the cost is visible before anything is sent.
  const PRICE_PER_PHOTO = 35;
  function angleCount() { return [...document.querySelectorAll('.rc-angle')].map(i => i.files[0]).filter(Boolean).length; }
  function updateRunLabel() {
    const n = angleCount();
    $('rc-run').textContent = n > 0
      ? `Run batch — ${n} angle${n === 1 ? '' : 's'} × $35 = $${n * PRICE_PER_PHOTO}`
      : 'Run batch — $35 per photo';
    $('rc-test-one').textContent = 'Test one angle first — $35';
  }
  [...document.querySelectorAll('.rc-angle')].forEach(i => i.addEventListener('change', updateRunLabel));
  updateRunLabel();

  // Results accumulate in the grid beside the form — a new run never
  // wipes the previous one. Each run remembers its space, style and time.
  let runs = [];
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
      runs.unshift({ batchId: out.batchId, images, results: out.results, space: $('rc-space').value.trim() || 'space', recipeName: recipe.name, ranAt: new Date().toISOString() });
      status(`Done — ${out.results.length} angle${out.results.length === 1 ? '' : 's'} edited with ${out.model}. Ran with ${out.promptSource === 'override' ? 'your edited prompt' : 'the pack default prompt'}. Check each one in step 04, then save the ones you approve.`);
      renderResults();
      loadBatches();
    } catch (e) { err(e); status(''); }
  }
  $('rc-test-one').addEventListener('click', () => run(true));
  $('rc-run').addEventListener('click', () => run(false));

  function renderResults() {
    const box = $('rc-results');
    box.replaceChildren();
    if (!runs.length) {
      box.append(el('p', { class: 'rc-msg', text: 'No results yet — run a batch and each angle appears here, beside the form.' }));
      return;
    }
    for (const entry of runs) {
      const originals = {};
      entry.images.forEach(i => { originals[i.name] = i.dataUrl; });
      const when = new Date(entry.ranAt).toLocaleString();
      const runEl = el('div', { class: 'rc-run' }, [
        el('p', { class: 'rc-run-head', text: `${entry.space} · ${entry.recipeName} · ${when}` }),
      ]);
      const grid = el('div', { class: 'rc-results-grid' });
      for (const r of entry.results) {
        const cb = el('input', { type: 'checkbox', 'aria-label': 'Approve ' + r.angleName });
        cb.checked = true;
        cb.setAttribute('data-angle', r.angleName);
        const card = el('div', { class: 'rc-result-card' }, [
          el('h3', { text: r.angleName + ' → ' + r.editedFilename }),
          el('div', { class: 'rc-compare' }, [
            el('figure', {}, [
              el('div', { class: 'rc-shot' }, [el('img', { src: originals[r.angleName], alt: 'Original: ' + r.angleName }), el('span', { class: 'rc-badge', text: 'Before' })]),
              el('figcaption', { text: 'Original' }),
            ]),
            el('figure', {}, [
              el('div', { class: 'rc-shot' }, [el('img', { src: r.dataUrl, alt: 'Edited: ' + r.angleName }), el('span', { class: 'rc-badge after', text: 'After' })]),
              el('figcaption', { text: 'Edited — ' + r.editedFilename }),
            ]),
          ]),
          el('p', { class: 'rc-result-meta' }, [
            el('span', { class: 'rc-style-badge', text: entry.recipeName }),
            el('span', { text: ' ' + entry.space + ' · ' + when }),
          ]),
          el('label', {}, [cb, el('span', { text: ' Approve this angle' })]),
        ]);
        grid.append(card);
      }
      runEl.append(grid);
      const save = el('button', { class: 'rc-btn pink', type: 'button', text: 'Save approved set' });
      const msg = el('p', { class: 'rc-msg', role: 'status' });
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          const approvals = entry.results.filter(x => runEl.querySelector(`input[data-angle="${CSS.escape(x.angleName)}"]`).checked)
            .map(x => ({ angleName: x.angleName, dataUrl: x.dataUrl }));
          if (!approvals.length) throw new Error('Approve at least one angle.');
          const out = await api('approve', { batchId: entry.batchId, approvals });
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
      runEl.append(el('div', { class: 'rc-box' }, [save, msg]));
      box.append(runEl);
    }
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
