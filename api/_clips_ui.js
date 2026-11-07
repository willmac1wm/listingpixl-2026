// AI Clips panel on the team dashboard (/staff), below the Recipe Studio.
// Plain browser JS; every value from the API goes on the page as text.
//
// Flow: drop finished photos (Start; for a walkthrough also up to 3 Middle
// photos and an End photo) → pick a camera move, a length, and optionally
// type extra direction → see the exact prompt → Make clip (one paid fal.ai
// clip, confirmed first) → the page checks every 5 seconds and shows the
// video with a Download link. Middle photos switch to Kling v4 and the
// button price updates before anything is sent.
// It borrows the Recipe Studio's look (.rc-studio classes) so the two
// panels read as one tool; only the .cl-* rules below are new.
const css = `
    .cl-studio .rc-panel-move { --rc-tone: var(--rc-blue-deep); --rc-tint: #f0f6ff; --rc-band: #d6e7ff; --rc-edge: #a3caff; }
    .cl-slots { display: grid; grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr)) 1.4fr; gap: 0.6rem; }
    .cl-slots .rc-slot { min-height: 170px; }
    .cl-slots .cl-mid { min-height: 130px; align-self: center; }
    .cl-slot-off { opacity: 0.4; pointer-events: none; }
    .cl-order { font-size: 0.9rem; color: var(--rc-muted); margin: 0.6rem 0 0; }
    .cl-moves { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.6rem; margin-bottom: var(--rc-space); }
    .cl-move { font: inherit; font-weight: 700; font-size: 1rem; min-height: 56px; border: 2px solid var(--rc-line); border-radius: 12px; background: #fff; color: var(--rc-ink); cursor: pointer; padding: 0.5rem 0.75rem; text-align: left; }
    .cl-move:hover { border-color: var(--rc-blue); }
    .cl-move.rc-selected { border-color: var(--rc-blue); box-shadow: 0 0 0 3px var(--rc-blue); background: #e6f0ff; }
    .cl-move small { display: block; font-weight: 400; font-size: 0.82rem; color: var(--rc-muted); }
    .cl-move:focus-visible { outline: 3px solid var(--rc-blue); outline-offset: 2px; }
    .cl-studio .cl-extra textarea { min-height: 90px; margin-top: 0.3rem; font-weight: 400; }
    .cl-count { font-size: 0.85rem; color: var(--rc-muted); font-weight: 400; }
    .cl-prompt { margin-top: 0.75rem; }
    .cl-prompt summary { cursor: pointer; font-weight: 700; font-size: 0.95rem; }
    .cl-prompt-text { white-space: pre-wrap; font-size: 0.9rem; line-height: 1.45; background: #fff; border: 1px solid var(--rc-line); border-radius: 10px; padding: 0.75rem; margin: 0.5rem 0 0; }
    .cl-model { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem; }
    .cl-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: var(--rc-space); margin-top: var(--rc-space); }
    .cl-results:empty { display: none; }
    .cl-results video { width: 100%; border-radius: 8px; display: block; background: #000; }
    @media (max-width: 860px) {
      .cl-slots { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .cl-slots .cl-start, .cl-slots .cl-end { grid-column: span 3; }
    }
    @media (max-width: 560px) {
      .cl-moves { grid-template-columns: minmax(0, 1fr); }
      .cl-slots .cl-mid { min-height: 110px; }
    }
`;

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const slot = (id, title, hint, cls) => `
              <div class="rc-slot ${cls}" id="${id}-wrap">
                <input id="${id}" class="rc-slot-input" type="file" accept="${IMAGE_TYPES}" aria-label="${title}">
                <div class="rc-slot-face"><b>${title}</b><small>${hint}</small></div>
                <button class="rc-slot-clear" type="button" aria-label="Remove ${title}" hidden>×</button>
              </div>`;

const html = `
    <section class="dash-section rc-studio cl-studio" id="ai-clips">
      <div class="rc-hero">
        <h2>AI Clips — camera moves from finished photos</h2>
        <p class="rc-hero-sub">Push-ins, pans and room-to-room walkthroughs for Reels and the property video. Pay per clip on fal.ai — no subscription.</p>
      </div>
      <div class="rc-toolbar">
        <p class="rc-key-status rc-key-off" id="cl-key-status" role="status">Checking the video API key…</p>
      </div>
      <div class="rc-steps">
        <div class="rc-panel rc-panel-upload">
          <div class="rc-panel-head"><div class="rc-panel-title">
            <h3 class="rc-step"><span class="rc-step-num">01</span> Photos</h3>
            <p class="rc-step-sub">Finished, edited photos only. Middle and End photos are for walkthroughs.</p>
          </div></div>
          <div class="rc-panel-body">
            <div class="cl-slots">${slot('cl-start', 'Start photo', 'Click or drop — where the clip begins', 'rc-slot-anchor cl-start')}${slot('cl-mid1', 'Middle 1', 'Optional', 'cl-mid')}${slot('cl-mid2', 'Middle 2', 'Optional', 'cl-mid')}${slot('cl-mid3', 'Middle 3', 'Optional', 'cl-mid')}${slot('cl-end', 'End photo', 'Where the clip ends', 'rc-slot-anchor cl-end')}
            </div>
            <p class="cl-order">The camera passes the photos left to right. Start + End only = Kling 2.5 (cheaper). Add any Middle photo and it switches to Kling v4, which follows every photo in order.</p>
          </div>
        </div>
        <div class="rc-panel rc-panel-move">
          <div class="rc-panel-head"><div class="rc-panel-title">
            <h3 class="rc-step"><span class="rc-step-num">02</span> Camera move &amp; prompt</h3>
            <p class="rc-step-sub">The camera moves; the house never changes. No added rooms, furniture or people.</p>
          </div></div>
          <div class="rc-panel-body">
            <div class="cl-moves" id="cl-moves"><p class="rc-msg">Loading moves…</p></div>
            <div class="rc-segment" role="group" aria-label="Clip length">
              <button class="rc-seg-btn rc-seg-active" type="button" data-len="5" aria-pressed="true">5 seconds</button>
              <button class="rc-seg-btn" type="button" data-len="10" aria-pressed="false">10 seconds</button>
            </div>
            <label class="rc-field cl-extra">Extra direction (optional) <span class="cl-count" id="cl-count"></span>
              <textarea id="cl-extra" maxlength="300" placeholder="e.g. start low and rise slightly; linger on the ocean view through the sliders"></textarea>
            </label>
            <p class="rc-msg">Typed direction is added to the camera move. The house rules are always added after it, so nothing typed here can add rooms, furniture or people.</p>
            <details class="cl-prompt" id="cl-prompt-box">
              <summary>See the exact prompt that will be sent</summary>
              <p class="cl-prompt-text" id="cl-prompt-text">Pick a camera move.</p>
            </details>
          </div>
        </div>
        <div class="rc-panel rc-panel-run">
          <div class="rc-panel-head"><div class="rc-panel-title">
            <h3 class="rc-step"><span class="rc-step-num">03</span> Make clip</h3>
            <p class="rc-step-sub">One paid clip each time. Takes about 1–3 minutes.</p>
          </div></div>
          <div class="rc-panel-body">
            <p class="cl-model" id="cl-model"></p>
            <div class="rc-run-actions"><button class="rc-btn pink" id="cl-make" type="button" style="font-size:1.15rem;font-weight:800;min-height:56px">Make clip</button></div>
            <p class="rc-msg" id="cl-status" role="status"></p>
            <p class="rc-msg rc-err" id="cl-error" role="alert"></p>
            <div class="cl-results" id="cl-results"></div>
          </div>
        </div>
      </div>
    </section>
`;

function client() {
  const $ = id => document.getElementById(id);
  if (!$('ai-clips')) return;
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  async function api(action, body, query = '') {
    const r = await fetch(location.origin + '/staff/clips?action=' + action + query, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify(body),
    } : {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  const status = t => { $('cl-status').textContent = t; $('cl-error').textContent = ''; };
  const fail = e => { $('cl-error').textContent = e.message; };

  const MIDS = ['cl-mid1', 'cl-mid2', 'cl-mid3'];
  let moves = [], cost = { fast: { 5: 0.35, 10: 0.7 }, keyframes: { 5: 0.79, 10: 1.57 } };
  let models = { fast: 'Kling 2.5 Turbo Pro', keyframes: 'Kling v4 (multi-photo)' };
  let configured = false, move = 'push-in', length = 5, busy = false;
  const money = n => '$' + Number(n).toFixed(2);
  const current = () => moves.find(m => m.id === move) || { multi: false, label: 'Push in' };
  const midFiles = () => MIDS.map(id => $(id).files[0]).filter(Boolean);
  const tier = () => (current().multi && midFiles().length ? 'keyframes' : 'fast');

  function refresh() {
    const multi = current().multi;
    for (const id of [...MIDS, 'cl-end']) { $(id + '-wrap').classList.toggle('cl-slot-off', !multi); $(id).disabled = !multi; }
    const t = tier();
    $('cl-model').textContent = `Model: ${models[t]}${t === 'keyframes' ? ` — follows ${midFiles().length + 2} photos in order` : ''}`;
    const btn = $('cl-make');
    btn.textContent = `Make clip — ${length} s ≈ ${money(cost[t][length])}`;
    const ready = $('cl-start').files[0] && (!multi || $('cl-end').files[0]);
    btn.disabled = busy || !configured || !ready;
    for (const b of document.querySelectorAll('.cl-move')) {
      const on = b.dataset.move === move;
      b.classList.toggle('rc-selected', on); b.setAttribute('aria-pressed', String(on));
    }
    $('cl-count').textContent = `${$('cl-extra').value.length}/300`;
  }

  // Show the exact prompt (built on the server, same code the clip uses).
  let promptTimer;
  function refreshPrompt() {
    clearTimeout(promptTimer);
    promptTimer = setTimeout(() => {
      api('prompt', null, '&move=' + encodeURIComponent(move) + '&extra=' + encodeURIComponent($('cl-extra').value))
        .then(p => { $('cl-prompt-text').textContent = p.prompt; })
        .catch(e => { $('cl-prompt-text').textContent = e.message; });
    }, 300);
  }

  // Photo tiles: thumbnail + remove, same as the Recipe Studio upload.
  for (const id of ['cl-start', ...MIDS, 'cl-end']) {
    const input = $(id), wrap = $(id + '-wrap'), clear = wrap.querySelector('.rc-slot-clear');
    input.addEventListener('change', () => {
      wrap.querySelectorAll('.rc-slot-thumb, .rc-slot-name').forEach(n => n.remove());
      const f = input.files[0];
      if (f) {
        const img = el('img', { class: 'rc-slot-thumb', alt: '' });
        img.src = URL.createObjectURL(f);
        wrap.append(img, el('span', { class: 'rc-slot-name', text: f.name }));
      }
      clear.hidden = !f;
      refresh();
    });
    clear.addEventListener('click', () => { input.value = ''; input.dispatchEvent(new Event('change')); });
  }

  for (const b of document.querySelectorAll('#ai-clips [data-len]')) {
    b.addEventListener('click', () => {
      length = Number(b.dataset.len);
      for (const o of document.querySelectorAll('#ai-clips [data-len]')) { const on = o === b; o.classList.toggle('rc-seg-active', on); o.setAttribute('aria-pressed', String(on)); }
      refresh();
    });
  }
  $('cl-extra').addEventListener('input', () => { refresh(); refreshPrompt(); });

  // Shrink to 1600px JPEG (the clip is 1080p) so up to 5 photos stay well
  // under Vercel's upload limit.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.85) });
      };
      img.onerror = () => reject(new Error(file.name + ' could not be read as a photo.'));
      img.src = URL.createObjectURL(file);
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function follow(id, label) {
    for (let i = 0; i < 90; i++) { // about 7.5 minutes
      await wait(5000);
      const s = await api('check', null, '&id=' + encodeURIComponent(id));
      if (s.status === 'done') return s.videoUrl;
      status(`${label}: ${s.status === 'running' ? 'making the clip' : 'waiting in line'}… (${(i + 1) * 5} s)`);
    }
    throw new Error('The clip is taking unusually long. It may still finish — it was paid for — so check fal.ai, request ' + id + '.');
  }

  $('cl-make').addEventListener('click', async () => {
    const m = current(), t = tier(), price = money(cost[t][length]);
    const photos = m.multi ? midFiles().length + 2 : 1;
    if (!confirm(`Make one ${length}-second "${m.label}" clip from ${photos} photo${photos > 1 ? 's' : ''} with ${models[t]}? About ${price}, charged to your fal.ai account.`)) return;
    busy = true; refresh();
    try {
      status('Uploading photos…');
      const body = { move, duration: length, extra: $('cl-extra').value, start: await shrink($('cl-start').files[0]) };
      if (m.multi) {
        body.middles = await Promise.all(midFiles().map(shrink));
        body.end = await shrink($('cl-end').files[0]);
      }
      const { requestId } = await api('make', body);
      const label = `${m.label}, ${length} s`;
      status(`${label}: queued…`);
      const url = await follow(requestId, label);
      const video = el('video', { controls: '', playsinline: '', muted: '', loop: '' });
      video.src = url;
      const name = ($('cl-start').files[0].name.replace(/\.[^.]+$/, '') || 'clip') + `-${move}-${length}s.mp4`;
      const link = el('a', { class: 'rc-btn ghost', href: url, download: name, target: '_blank', rel: 'noopener', text: 'Download clip' });
      $('cl-results').prepend(el('div', { class: 'rc-result-card' }, [el('h3', { text: `${label} — ${models[t]} — ${price}` }), video, el('p', { class: 'rc-result-meta', text: 'Download it now — fal.ai only keeps the file for a limited time.' }), link]));
      status('Clip ready. Check it before it goes to an agent.');
    } catch (e) { fail(e); status(''); }
    busy = false; refresh();
  });

  api('status').then(s => {
    configured = s.configured; cost = s.cost; moves = s.moves; models = s.models;
    const k = $('cl-key-status');
    k.textContent = configured ? 'fal.ai key is set — clips are ready to make.' : 'No fal.ai key yet — add FAL_KEY in Vercel to turn clips on. Nothing can be spent until then.';
    k.classList.toggle('rc-key-off', !configured);
    const box = $('cl-moves'); box.textContent = '';
    const hints = { 'push-in': 'Slowly into the room', 'pull-out': 'Slowly back out', 'pan-left': 'Slide left', 'pan-right': 'Slide right', walkthrough: 'Start → middles → end' };
    for (const mv of moves) {
      const b = el('button', { class: 'cl-move', type: 'button', 'aria-pressed': 'false' }, [mv.label, el('small', { text: hints[mv.id] || '' })]);
      b.dataset.move = mv.id;
      b.addEventListener('click', () => {
        move = mv.id;
        if (!mv.multi) for (const id of [...MIDS, 'cl-end']) if ($(id).files.length) { $(id).value = ''; $(id).dispatchEvent(new Event('change')); }
        refresh(); refreshPrompt();
      });
      box.append(b);
    }
    refresh(); refreshPrompt();
  }).catch(e => { $('cl-key-status').textContent = 'Clips could not load: ' + e.message; });
  refresh();
}

module.exports = { css, html, script: `(${client.toString()})();` };
