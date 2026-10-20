// "New shoots" panel on the team dashboard: pick an HD Photo Hub shoot, then
// review, edit and approve the drafts that api/shoots.js serves. Plain browser
// JS; every value from the API is put on the page as text, never as HTML.

const css = `
    .sh-box { border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); padding: 1rem 1.1rem; margin: 0.75rem 0; }
    .sh-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .sh-box select, .sh-box input, .sh-box textarea { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid #cfc8b8; border-radius: 8px; background: #fff; color: #1d1d1d; max-width: 100%; }
    .sh-box select { flex: 1 1 320px; }
    .sh-box textarea { width: 100%; min-height: 7.5rem; box-sizing: border-box; }
    .sh-btn { font: inherit; border: 0; border-radius: 999px; padding: 0.5rem 1.1rem; cursor: pointer; background: #1d1d1d; color: #fff; }
    .sh-btn.pink { background: var(--accent-pink, #d63384); }
    .sh-btn.ghost { background: transparent; color: #1d1d1d; border: 1px solid #cfc8b8; }
    .sh-btn:disabled { opacity: 0.5; cursor: wait; }
    .sh-msg { font-size: 0.9rem; color: var(--muted, #555); margin: 0.4rem 0 0; }
    .sh-err { color: #b00020; }
    .sh-draft h3 { margin: 0 0 0.25rem; font-size: 1.1rem; text-align: left; }
    .sh-note { background: #fff7e0; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.9rem; margin: 0.5rem 0; }
    .sh-chan { border-top: 1px solid #eee; padding-top: 0.75rem; margin-top: 0.75rem; }
    .sh-chan h4 { margin: 0 0 0.4rem; font-size: 0.98rem; text-align: left; display: flex; gap: 0.5rem; align-items: center; }
    .sh-thumbs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; }
    .sh-thumbs label { position: relative; display: block; cursor: pointer; }
    .sh-thumbs img { width: 112px; height: 75px; object-fit: cover; border-radius: 6px; display: block; }
    .sh-thumbs input { position: absolute; top: 4px; left: 4px; }
    .sh-thumbs label.off img { opacity: 0.3; }
    .sh-story { width: 108px; height: 192px; object-fit: cover; border-radius: 8px; }
    .sh-count { font-size: 0.8rem; color: var(--muted, #666); font-weight: normal; }
`;

const html = `
    <section class="dash-section" id="shoots">
      <h2>New shoots: blog, Google, Facebook and Instagram</h2>
      <div class="sh-box">
        <div class="sh-row">
          <select id="sh-site" aria-label="Shoot from HD Photo Hub"><option>Loading shoots from HD Photo Hub…</option></select>
          <button class="sh-btn pink" id="sh-go" type="button" disabled>Write the posts</button>
        </div>
        <p class="sh-msg">Pick a shoot. In about 5 minutes the draft blog post and social posts appear below for you to check. Nothing is published until you press Approve.</p>
        <p class="sh-msg sh-err" id="sh-load-err" role="alert"></p>
        <p class="sh-msg" id="sh-status" role="status"></p>
      </div>
      <div id="sh-working"></div>
      <div id="sh-drafts"></div>
      <div id="sh-pending"></div>
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
    const r = await fetch(location.origin + '/staff/shoots?action=' + action, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify(body),
    } : {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  const status = (t, bad) => { const s = $('sh-status'); s.textContent = t; s.classList.toggle('sh-err', !!bad); };

  function nextEvening() {
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    if (d < new Date(Date.now() + 15 * 60e3)) d.setDate(d.getDate() + 1);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  async function loadSites() {
    try {
      const sites = await api('sites');
      const sel = $('sh-site');
      sel.replaceChildren(...sites.map(s => el('option', {
        value: s.sid,
        text: `${s.address}, ${s.city} · ${s.created} · ${s.photos} photos${s.agent ? ' · ' + s.agent : ''}${s.onBlog ? ' · already on blog' : ''}${s.drafted ? ' · draft waiting' : ''}`,
      })));
      const first = sites.find(s => !s.onBlog && !s.drafted);
      if (first) sel.value = first.sid;
      $('sh-go').disabled = false;
    } catch (e) {
      $('sh-site').replaceChildren(el('option', { text: 'Could not load shoots' }));
      $('sh-load-err').textContent = 'Loading shoots failed: ' + e.message;
    }
  }

  $('sh-go').addEventListener('click', async () => {
    const btn = $('sh-go');
    if (!/^\d+$/.test($('sh-site').value)) return status('Pick a shoot first.', true);
    btn.disabled = true;
    try {
      await api('draft', { sid: $('sh-site').value });
      status('Started. The draft will show up below in about 5 minutes (this page checks every 30 seconds).');
      setTimeout(refresh, 5000);
    } catch (e) { status(e.message, true); }
    btn.disabled = false;
  });

  function photoPicker(d, files) {
    const box = el('div', { class: 'sh-thumbs' });
    for (const [file, alt] of d.photos) {
      const on = files.includes(file);
      const cb = el('input', { type: 'checkbox', 'data-file': file, 'aria-label': alt });
      cb.checked = on;
      const lab = el('label', { class: on ? '' : 'off', title: alt }, [cb, el('img', { src: d.photoBase + file.replace(/\.jpg$/, '-480.jpg'), alt, loading: 'lazy', onerror: e => { if (e.target.src.endsWith('-480.jpg')) e.target.src = e.target.src.replace(/-480\.jpg$/, '.jpg'); } })]);
      cb.addEventListener('change', () => lab.classList.toggle('off', !cb.checked));
      box.append(lab);
    }
    return box;
  }
  const picked = box => [...box.querySelectorAll('input:checked')].map(i => i.dataset.file);

  function copyButton(getText, label = 'Copy') {
    const b = el('button', { class: 'sh-btn ghost', type: 'button', text: label });
    b.addEventListener('click', async () => { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = label), 1500); });
    return b;
  }

  function channel(title, on, kids) {
    const cb = el('input', { type: 'checkbox', 'aria-label': 'Post to ' + title });
    cb.checked = on;
    return { cb, node: el('div', { class: 'sh-chan' }, [el('h4', {}, [cb, el('span', { text: title })]), ...kids]) };
  }

  function draftCard(d) {
    const chans = d.channels || ['facebook', 'instagram', 'story'];
    const fbText = el('textarea', { 'aria-label': 'Facebook post' }); fbText.value = d.facebook.text;
    const igText = el('textarea', { 'aria-label': 'Instagram caption' }); igText.value = d.instagram.text;
    const gText = el('textarea', { 'aria-label': 'Google Business post' }); gText.value = d.google.text;
    const igCount = el('span', { class: 'sh-count' });
    const gCount = el('span', { class: 'sh-count' });
    const counts = () => { igCount.textContent = `${igText.value.length} / 2,200`; gCount.textContent = `${gText.value.length} / 1,500`; };
    igText.addEventListener('input', counts); gText.addEventListener('input', counts); counts();
    const fbPhotos = photoPicker(d, d.facebook.photos);
    const igPhotos = photoPicker(d, d.instagram.photos);
    const fb = channel('Facebook page post', chans.includes('facebook'), [fbText, fbPhotos]);
    const ig = channel('Instagram post', chans.includes('instagram'), [el('div', {}, [igCount]), igText, igPhotos, el('p', { class: 'sh-msg', text: 'Up to 10 photos. The first one is the cover.' })]);
    const st = channel('Instagram story', chans.includes('story'), [el('img', { class: 'sh-story', src: d.photoBase + d.story.photo, alt: 'Story image' })]);
    const google = el('div', { class: 'sh-chan' }, [
      el('h4', { text: 'Google Business post (post it by hand for now)' }), el('div', {}, [gCount]), gText,
      el('div', { class: 'sh-row' }, [
        copyButton(() => gText.value, 'Copy text'), copyButton(() => d.google.link, 'Copy button link'),
        el('a', { class: 'sh-btn ghost', href: d.photoBase + d.google.photo, download: d.google.photo, target: '_blank', rel: 'noopener', text: 'Photo' }),
        el('a', { class: 'sh-btn ghost', href: 'https://business.google.com/locations', target: '_blank', rel: 'noopener', text: 'Open Google profile' }),
      ]),
      el('p', { class: 'sh-msg', text: 'On the profile: Add update, paste the text, add the photo, button "Learn more" with the copied link. Do it after you approve, once the blog post is live.' }),
    ]);
    const when = el('input', { type: 'datetime-local', 'aria-label': 'When to post to Facebook and Instagram' });
    when.value = nextEvening();
    const notes = el('textarea', { placeholder: 'What should change? e.g. "use the twilight as the first photo, leave out the garage"', 'aria-label': 'Changes for a redo' });
    notes.style.minHeight = '3.5rem';
    const msg = el('p', { class: 'sh-msg', role: 'status' });
    const edits = () => ({
      slug: d.slug,
      facebook: { ...d.facebook, text: fbText.value, photos: picked(fbPhotos) },
      instagram: { ...d.instagram, text: igText.value, photos: picked(igPhotos).slice(0, 10) },
      google: { ...d.google, text: gText.value },
      channels: [fb.cb.checked && 'facebook', ig.cb.checked && 'instagram', st.cb.checked && 'story'].filter(Boolean),
    });
    const act = (label, cls, fn) => {
      const b = el('button', { class: 'sh-btn ' + cls, type: 'button', text: label });
      b.addEventListener('click', async () => {
        card.querySelectorAll('button').forEach(x => (x.disabled = true));
        msg.classList.remove('sh-err');
        try { msg.textContent = await fn(); } catch (e) { msg.textContent = e.message; msg.classList.add('sh-err'); }
        card.querySelectorAll('button').forEach(x => (x.disabled = false));
      });
      return b;
    };
    const card = el('div', { class: 'sh-box sh-draft' }, [
      el('h3', { text: `${d.address}, ${d.town}` }),
      el('p', { class: 'sh-msg', text: `Shot ${d.shot}${d.agent ? ' for ' + d.agent : ''} · ${d.photos.length} photos picked · drafted ${new Date(d.drafted).toLocaleString()}` }),
      el('div', { class: 'sh-row' }, [
        d.preview ? el('a', { class: 'sh-btn', href: d.preview + d.blog, target: '_blank', rel: 'noopener', text: 'See the blog post (preview)' })
          : el('span', { class: 'sh-msg', text: 'Preview is still building; reload in a minute.' }),
      ]),
      d.notes_for_review && d.notes_for_review !== 'None' ? el('p', { class: 'sh-note', text: 'Claude says: ' + d.notes_for_review }) : null,
      d.left_out ? el('p', { class: 'sh-msg', text: 'Left out: ' + d.left_out }) : null,
      fb.node, ig.node, st.node, google,
      el('div', { class: 'sh-chan' }, [
        el('h4', { text: 'Approve' }),
        el('div', { class: 'sh-row' }, [
          el('label', { text: 'Post to Facebook and Instagram at ' }), when,
          act('Save edits', 'ghost', async () => { await api('save', edits()); return 'Saved.'; }),
          act('Approve and publish', 'pink', async () => {
            if (!confirm(`Put ${d.address} on the live website now, and post it to the ticked social channels at ${new Date(when.value).toLocaleString()}?`)) return '';
            const r = await api('approve', { ...edits(), post_at: new Date(when.value).toISOString() });
            setTimeout(refresh, 2000);
            return `Approved. The blog post goes live on the ${r.base} branch in a couple of minutes.`;
          }),
        ]),
        el('h4', { text: 'Or redo / reject', style: 'margin-top:0.9rem' }), notes,
        el('div', { class: 'sh-row' }, [
          act('Redo with these changes', 'ghost', async () => { await api('reject', { slug: d.slug, sid: d.sid, redo: true, notes: notes.value }); setTimeout(refresh, 2000); return 'Redoing. The new draft shows up in about 5 minutes.'; }),
          act('Reject', 'ghost', async () => { if (!confirm('Throw this draft away?')) return ''; await api('reject', { slug: d.slug }); setTimeout(refresh, 1000); return 'Rejected.'; }),
        ]),
        msg,
      ]),
    ]);
    return card;
  }

  let editing = false;
  const refresh = () => { editing = false; loadDrafts(true); };
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.sh-draft')) editing = true; });

  async function loadDrafts(force) {
    if (editing && !force) return;
    try {
      const { drafts, pending, working } = await api('drafts');
      $('sh-working').replaceChildren(...working.map(w => el('div', { class: 'sh-box' }, [
        el('span', { text: w.status === 'completed' ? `The draft for shoot ${w.sid} failed. ` : `Writing the draft for shoot ${w.sid}… (started ${new Date(w.started).toLocaleTimeString()}) ` }),
        el('a', { href: w.url, target: '_blank', rel: 'noopener', text: 'details' }),
      ])));
      $('sh-drafts').replaceChildren(...drafts.map(draftCard));
      $('sh-pending').replaceChildren(...pending.map(p => el('div', { class: 'sh-box' }, [
        el('strong', { text: `${p.address}, ${p.town}: ` }),
        el('span', { text: p.status === 'approved' ? `approved, social posts go out ${new Date(p.post_at).toLocaleString()}. ` : '' }),
        el('span', { text: Object.keys(p.posted || {}).length ? `Posted: ${Object.keys(p.posted).join(', ')}. ` : '' }),
        Object.keys(p.errors || {}).length ? el('span', { class: 'sh-err', text: 'Problems: ' + Object.entries(p.errors).map(([k, v]) => `${k}: ${v}`).join('; ') }) : null,
      ])));
    } catch (e) { $('sh-working').replaceChildren(el('p', { class: 'sh-msg sh-err', text: 'Loading drafts failed: ' + e.message })); }
  }

  loadSites();
  loadDrafts(true);
  setInterval(loadDrafts, 30000);
}

module.exports = { css, html, script: `(${client.toString()})();` };
