// Sites page content for /staff/sites: HD Photo Hub sites as HD-style
// cards, 3 across — property photo where HD returns one, address,
// city/state, Site #, agent, shoot date, photo count. Search box and
// sort (newest / oldest / address A–Z) filter the cards on the page.
// "Create a New Real Estate Site" links OUT to HD Photo Hub — site
// creation is not rebuilt here. No status column: HD's status (Preparing,
// Delivery Only, Live…) is not in the fields this API returns, and no
// status is invented. A site with no photo URL shows its photo count
// instead of a broken image.
const css = `
    .st-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
    .st-toolbar input, .st-toolbar select { font: inherit; padding: 0.5rem 0.7rem; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 8px; background: #fff; }
    .st-toolbar input { flex: 1 1 220px; }
    .st-new { font: inherit; font-weight: 700; text-decoration: none; color: #fff; background: #14262b; border-radius: 999px; padding: 0.6rem 1.2rem; }
    .st-new:hover, .st-new:focus-visible { background: #d71266; }
    .st-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    @media (max-width: 900px) { .st-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .st-grid { grid-template-columns: 1fr; } }
    .st-card { background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; overflow: hidden; }
    .st-card img { display: block; width: 100%; height: 160px; object-fit: cover; }
    .st-nophoto { display: flex; align-items: center; justify-content: center; height: 160px; background: #e2e3df; color: #4f5b5e; font-weight: 700; }
    .st-card-body { padding: 0.75rem 0.9rem 0.9rem; }
    .st-card-body strong { display: block; font-size: 1.05rem; }
    .st-card-body p { margin: 0.25rem 0; font-size: 0.9rem; color: var(--muted, #4f5b5e); }
    .st-pill { display: inline-block; background: #0c7a8c; color: #fff; font-size: 0.8rem; font-weight: 700; padding: 0.1rem 0.6rem; border-radius: 999px; margin-right: 0.3rem; }
    .st-card-body a { font-weight: 700; color: var(--ink, #1d1d1d); }
    .st-msg { color: var(--muted, #4f5b5e); margin: 0.25rem 0; }
    .st-err { color: #8d1e3a; margin: 0.25rem 0; }
`;

const html = `
    <section class="dash-panel dash-panel-blue" id="sites">
      <div class="dash-panel-head"><h2>Sites</h2><p class="dash-panel-sub">Latest 30 sites from HD Photo Hub. Site creation stays in HD Photo Hub.</p></div>
      <div class="dash-panel-body">
        <div class="st-toolbar">
          <input id="st-search" type="search" placeholder="Search address or agent…" aria-label="Search sites">
          <select id="st-sort" aria-label="Sort sites">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="address">Address A–Z</option>
          </select>
          <a class="st-new" href="https://listingpixl.hd.pics/Sites/search.asp" target="_blank" rel="noopener noreferrer">Create a New Real Estate Site</a>
        </div>
        <p class="st-msg" id="st-status" role="status">Loading sites…</p>
        <p class="st-err" id="st-load-err" role="alert"></p>
        <div class="st-grid" id="st-grid"></div>
      </div>
    </section>
`;

function client() {
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k === 'href') n.setAttribute('href', v); else if (k === 'src') n.setAttribute('src', v);
      else if (k === 'alt') n.setAttribute('alt', v); else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  let sites = [];
  function render() {
    const q = ($('st-search').value || '').trim().toLowerCase();
    const sort = $('st-sort').value;
    let list = sites.filter(s => !q || `${s.address} ${s.city} ${s.agent}`.toLowerCase().includes(q));
    if (sort === 'oldest') list = [...list].sort((a, b) => String(a.created).localeCompare(String(b.created)));
    else if (sort === 'address') list = [...list].sort((a, b) => `${a.address} ${a.city}`.toLowerCase().localeCompare(`${b.address} ${b.city}`.toLowerCase()));
    else list = [...list].sort((a, b) => String(b.created).localeCompare(String(a.created)));
    const grid = $('st-grid');
    grid.replaceChildren();
    $('st-status').textContent = list.length ? `${list.length} site${list.length === 1 ? '' : 's'}.` : 'No sites match.';
    for (const s of list) {
      const media = s.photo
        ? el('img', { src: s.photo, alt: `${s.address}, ${s.city}` })
        : el('div', { class: 'st-nophoto', text: `${s.photos} photo${s.photos === 1 ? '' : 's'}` });
      grid.append(el('article', { class: 'st-card' }, [
        media,
        el('div', { class: 'st-card-body' }, [
          el('strong', { text: `${s.address}, ${s.city}` }),
          el('p', { text: `Site #${s.sid} · shot ${s.created || ''} · ${s.agent || '—'}` }),
          el('p', {}, [
            s.onBlog ? el('span', { class: 'st-pill', text: 'On blog' }) : null,
            s.drafted ? el('span', { class: 'st-pill', text: 'Drafting' }) : null,
            el('span', { text: `${s.photos} photo${s.photos === 1 ? '' : 's'}` }),
          ]),
          el('p', {}, [el('a', { href: '/staff/posts', text: 'Open drafts →' })]),
        ]),
      ]));
    }
  }
  $('st-search').addEventListener('input', render);
  $('st-sort').addEventListener('change', render);
  fetch(location.origin + '/staff/shoots?action=sites')
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(list => { sites = Array.isArray(list) ? list : []; render(); })
    .catch(e => { $('st-status').textContent = ''; $('st-load-err').textContent = 'Could not load HD sites: ' + (e.message || 'HD Photo Hub is unavailable.'); });
}

module.exports = {
  css, html,
  script: `(${client.toString()})();`,
};
