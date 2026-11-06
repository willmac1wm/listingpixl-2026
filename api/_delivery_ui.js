// Delivery-service / mini-CRM panel on the team dashboard (/staff). Plain
// browser JS; every value from the API is put on the page as text, never
// as HTML.
//
// One record per shoot: client/agent, address, package, status, Stripe
// Payment Link, HD Photo Hub site id, tour/video URLs (plain URLs rendered
// as iframes — no API key), tokenised client gallery link with expiry,
// approved files, and the delivery text/email/follow-up/review strings.
//
// DRAFTS ONLY: the strings here are never sent from this panel. There is
// no send button and no send endpoint. Copy the text, show William the
// exact final wording in chat, and only then send it by hand.
const css = `
    .dv-box { border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); padding: 1rem 1.1rem; margin: 0.75rem 0; }
    .dv-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .dv-box select, .dv-box input, .dv-box textarea { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid #cfc8b8; border-radius: 8px; background: #fff; color: #1d1d1d; max-width: 100%; }
    .dv-box textarea { width: 100%; min-height: 4.5rem; box-sizing: border-box; }
    .dv-box label { font-size: 0.9rem; display: block; margin: 0.4rem 0 0.15rem; }
    .dv-btn { font: inherit; border: 0; border-radius: 999px; padding: 0.5rem 1.1rem; cursor: pointer; background: #1d1d1d; color: #fff; }
    .dv-btn.pink { background: var(--accent-pink, #d63384); }
    .dv-btn.ghost { background: transparent; color: #1d1d1d; border: 1px solid #cfc8b8; }
    .dv-btn:disabled { opacity: 0.5; cursor: wait; }
    .dv-msg { font-size: 0.9rem; color: var(--muted, #555); margin: 0.4rem 0 0; }
    .dv-err { color: #b00020; }
    .dv-warn { background: #fff7e0; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.9rem; margin: 0.5rem 0; }
    .dv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem; }
    .dv-thumb { width: 100%; height: auto; border-radius: 8px; display: block; }
`;

const html = `
    <section class="dash-section" id="delivery">
      <h2>Delivery — shoots, gallery links, and what to send</h2>
      <p class="dv-warn"><strong>Drafts only.</strong> Nothing on this panel sends anything. Copy the text, show William the exact final wording in chat, and only then send it by hand. HD Photo Hub stays the fallback for ordering, pricing, and checkout.</p>
      <div class="dv-box">
        <div class="dv-row">
          <select id="dv-shoot" aria-label="Delivery shoot"><option>Loading shoots…</option></select>
          <button class="dv-btn" id="dv-new" type="button">New shoot</button>
        </div>
        <div id="dv-create" hidden>
          <label>Address <input id="dv-address" placeholder="114 E Anna St"></label>
          <label>City / town <input id="dv-city" placeholder="Whitesboro"></label>
          <label>Agent name <input id="dv-agent" placeholder="Jason Ruffenach"></label>
          <label>Package
            <select id="dv-package"><option>Essential</option><option>Standard</option><option>Marketing</option><option>Luxury</option><option>Signature</option><option>Vacation Rental</option></select>
          </label>
          <label>HD Photo Hub site id <input id="dv-hdph" placeholder="3531912" inputmode="numeric"></label>
          <div class="dv-row" style="margin-top:.5rem"><button class="dv-btn pink" id="dv-create-go" type="button">Create shoot record</button></div>
        </div>
        <p class="dv-msg" id="dv-status" role="status"></p>
        <p class="dv-msg dv-err" id="dv-error" role="alert"></p>
      </div>
      <div id="dv-detail"></div>
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
    const r = await fetch(location.origin + '/staff/delivery?action=' + action, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify(body),
    } : {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  const err = e => { $('dv-error').textContent = e.message; };
  const status = t => { $('dv-status').textContent = t; $('dv-error').textContent = ''; };
  const copyButton = getText => {
    const b = el('button', { class: 'dv-btn ghost', type: 'button', text: 'Copy' });
    b.addEventListener('click', async () => { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500); });
    return b;
  };

  let shoots = [];
  let current = null;
  let editing = false;
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#dv-detail')) editing = true; });

  async function loadShoots() {
    try {
      shoots = await api('shoots');
      const sel = $('dv-shoot');
      sel.replaceChildren(...(shoots.length ? shoots.map(s => el('option', { value: s.slug, text: `${s.address}, ${s.city} · ${s.package} · ${s.status}${s.expired ? ' · gallery expired' : ''}` })) : [el('option', { text: 'No delivery shoots yet — create one below' })]));
      if (shoots.length && !current) { sel.value = shoots[0].slug; current = shoots[0]; renderDetail(); }
    } catch (e) { $('dv-shoot').replaceChildren(el('option', { text: 'Could not load shoots' })); err(e); }
  }
  $('dv-shoot').addEventListener('change', async () => {
    try { current = await api('shoot', { slug: $('dv-shoot').value }); editing = false; renderDetail(); } catch (e) { err(e); }
  });
  $('dv-new').addEventListener('click', () => { $('dv-create').hidden = false; });
  $('dv-create-go').addEventListener('click', async () => {
    try {
      const s = await api('createShoot', { address: $('dv-address').value, city: $('dv-city').value, agentName: $('dv-agent').value, package: $('dv-package').value, hdphSiteId: $('dv-hdph').value });
      status(`Created ${s.address}. Gallery link is ready below.`);
      $('dv-create').hidden = true;
      await loadShoots();
      $('dv-shoot').value = s.slug; current = s; renderDetail();
    } catch (e) { err(e); }
  });

  // MLS-ready export, in the browser: 2048px long edge, sRGB, JPEG, under 2 MB.
  // No new service, no upload — it reads the approved file and downloads the
  // resized copy. If a file will not fit under 2 MB it says so instead of
  // silently shipping a bad file.
  async function mlsReady(url, filename) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Could not load ' + filename + ' — check the file is still in Blob storage.')); img.src = url; });
    const scale = 2048 / Math.max(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.75, 0.65]) {
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
      if (!blob) throw new Error('Could not export ' + filename);
      if (blob.size <= 2 * 1024 * 1024) return { blob, bytes: blob.size, quality: q, width: c.width, height: c.height };
    }
    throw new Error(filename + ' will not fit under 2 MB even at low quality — check the source file.');
  }

  function renderDetail() {
    const box = $('dv-detail');
    box.replaceChildren();
    if (!current) return;
    const s = current;
    const statusSel = el('select', { 'aria-label': 'Status' });
    ['shot', 'editing', 'ready', 'delivered', 'followed-up', 'reviewed'].forEach(v => statusSel.append(el('option', { value: v, text: v, selected: s.status === v || undefined })));
    const stripe = el('input', { value: s.stripePaymentLink || '', placeholder: 'Stripe Payment Link (buy.stripe.com/…)', 'aria-label': 'Stripe Payment Link' });
    stripe.style.width = '100%';
    const tourInputs = {};
    for (const k of ['matterport', 'kuula', 'iguide', 'youtube', 'video']) {
      const inp = el('input', { value: s.tours?.[k] || '', placeholder: k + ' share link', 'aria-label': k + ' link' });
      inp.style.width = '100%';
      tourInputs[k] = inp;
    }
    const draftInputs = {};
    for (const [k, label] of [['text', 'Delivery text'], ['emailSubject', 'Email subject'], ['emailBody', 'Delivery email'], ['followUp', 'Follow-up (2 days)'], ['reviewAsk', 'Review ask']]) {
      const ta = el('textarea', { 'aria-label': label });
      ta.value = s.drafts?.[k] || '';
      draftInputs[k] = ta;
    }
    const msg = el('p', { class: 'dv-msg', role: 'status' });
    const save = el('button', { class: 'dv-btn pink', type: 'button', text: 'Save shoot' });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const tours = {}; for (const [k, inp] of Object.entries(tourInputs)) tours[k] = inp.value.trim();
        const drafts = {}; for (const [k, ta] of Object.entries(draftInputs)) drafts[k] = ta.value;
        current = await api('saveShoot', { slug: s.slug, status: statusSel.value, stripePaymentLink: stripe.value.trim(), tours, drafts });
        msg.textContent = 'Saved.';
        editing = false;
      } catch (e) { msg.textContent = e.message; msg.classList.add('dv-err'); }
      save.disabled = false;
    });
    const galleryLink = el('input', { value: s.galleryUrl, readonly: true, 'aria-label': 'Client gallery link' });
    galleryLink.style.width = '100%';
    const regen = el('button', { class: 'dv-btn ghost', type: 'button', text: 'New gallery link' });
    regen.addEventListener('click', async () => {
      if (!confirm('Make a new gallery link? The old one stops working.')) return;
      try { current = await api('regenerateToken', { slug: s.slug }); renderDetail(); status('New gallery link made.'); } catch (e) { err(e); }
    });

    const files = el('div', { class: 'dv-grid' });
    (s.files?.edited || []).forEach(f => {
      const dl = el('a', { class: 'dv-btn ghost', href: f.url, target: '_blank', rel: 'noopener', text: 'Open' });
      const mlsBtn = el('button', { class: 'dv-btn', type: 'button', text: 'Make MLS-ready' });
      const mlsMsg = el('p', { class: 'dv-msg' });
      mlsBtn.addEventListener('click', async () => {
        mlsBtn.disabled = true;
        try {
          const out = await mlsReady(f.url, f.filename);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(out.blob);
          a.download = f.filename.replace(/(\.[a-z0-9]+)$/i, '-MLS$1');
          a.textContent = `Download MLS-ready (${out.width}×${out.height}, ${(out.bytes / 1024).toFixed(0)} KB)`;
          a.className = 'dv-btn ghost';
          mlsMsg.replaceChildren(a);
        } catch (e) { mlsMsg.textContent = e.message; mlsMsg.classList.add('dv-err'); }
        mlsBtn.disabled = false;
      });
      files.append(el('div', { class: 'dv-box' }, [
        el('img', { class: 'dv-thumb', src: f.url, alt: f.filename, loading: 'lazy' }),
        el('p', { class: 'dv-msg', text: f.filename }),
        el('div', { class: 'dv-row' }, [dl, mlsBtn]), mlsMsg,
      ]));
    });

    const draftSection = el('div', {}, [
      el('h3', { text: 'What to send — drafts only, nothing sends from here' }),
      ...Object.entries(draftInputs).map(([k, ta]) => el('div', {}, [
        el('label', { text: { text: 'Delivery text', emailSubject: 'Email subject', emailBody: 'Delivery email', followUp: 'Follow-up (2 days)', reviewAsk: 'Review ask' }[k] }),
        ta, el('div', { class: 'dv-row' }, [copyButton(() => ta.value)]),
      ])),
    ]);

    box.append(el('div', { class: 'dv-box' }, [
      el('h3', { text: `${s.address}, ${s.city}` }),
      el('p', { class: 'dv-msg', text: `Agent: ${s.agentName || '—'}${s.brokerage ? ' · ' + s.brokerage : ''} · Shot ${s.shotDate} · ${s.photoCount || 0} photos${s.hdphSiteId ? ' · HD Photo Hub site ' + s.hdphSiteId : ''}` }),
      el('label', { text: 'Status' }), statusSel,
      el('label', { text: 'Stripe Payment Link' }), stripe,
      el('h3', { text: 'Tours & video — paste the share link, no API key' }),
      ...Object.entries(tourInputs).map(([k, inp]) => el('div', {}, [el('label', { text: k }), inp])),
      el('h3', { text: 'Client gallery link' }),
      el('p', { class: 'dv-msg', text: s.expired ? 'This link has expired — make a new one.' : `Expires ${(s.galleryExpiresAt || '').slice(0, 10)}.` }),
      galleryLink,
      el('div', { class: 'dv-row' }, [copyButton(() => galleryLink.value), regen, el('a', { class: 'dv-btn ghost', href: s.galleryUrl, target: '_blank', rel: 'noopener', text: 'Preview gallery' })]),
      el('h3', { text: 'Approved files' }),
      (s.files?.edited || []).length ? files : el('p', { class: 'dv-msg', text: 'No approved files yet — they land here from the Recipe Studio.' }),
      draftSection,
      el('div', { class: 'dv-row' }, [save]), msg,
    ]));
  }

  loadShoots();
  setInterval(() => { if (!editing) loadShoots(); }, 60000);
}

module.exports = { css, html, script: `(${client.toString()})();` };
