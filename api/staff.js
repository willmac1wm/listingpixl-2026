// Team dashboard home at /staff (Nov 2026): the dashboard is split into
// one page per job — Dashboard, Sites, Photo Editing, Posts, Clients, CRM,
// Business, Account — like HD Photo Hub, instead of one long scroll. This
// page is the Dashboard: welcome, stat tiles, Quick Start, what needs
// doing next, recent shoots, top clients, and the Learning Center links
// at the bottom. It has no sidebar, HD pattern.
//
// The page is built here, not stored as a public file, so nobody sees it
// without the team password. Browser sign-in uses an encrypted, expiring
// cookie; existing authenticated API access remains supported.
//
// Needs one Vercel environment variable: STAFF_PASSWORD. STAFF_USER is
// optional (default "team"). Until STAFF_PASSWORD is set the page stays
// locked for everyone.
//
// Stats come only from endpoints the sections already load — delivery
// shoots, HD sites, post drafts, recent batches. Each fetch is on its
// own, so one failure never takes out the others, and a failed number
// stays a dash instead of showing a wrong number. Where HD shows a stat
// we cannot compute (lifetime hits, scheduled sites, average site life),
// we leave it out rather than inventing it.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const guides = require('./_guides_ui');

const css = `
    .dash-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
    .dash-tile { background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; padding: 0.9rem 1rem; text-align: center; }
    .dash-tile b { display: block; font-size: 2rem; font-weight: 800; line-height: 1.1; color: var(--dash-tone, #0c7a8c); }
    .dash-tile span { font-size: 0.9rem; color: var(--muted, #4f5b5e); }
    .dash-quick { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .dash-quick a { font: inherit; font-weight: 700; text-decoration: none; color: #fff; background: #14262b; border-radius: 999px; padding: 0.7rem 1.4rem; }
    .dash-quick a:hover, .dash-quick a:focus-visible { background: #d71266; }
    .dash-rows { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
    .dash-rows li { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 10px; padding: 0.6rem 0.9rem; }
    .dash-rows li a { font-weight: 700; color: var(--ink, #1d1d1d); }
    .dash-rows li span { font-size: 0.9rem; color: var(--muted, #4f5b5e); }
    .dash-pill { display: inline-block; background: #0c7a8c; color: #fff; font-size: 0.8rem; font-weight: 700; padding: 0.1rem 0.6rem; border-radius: 999px; }
    .dash-empty { color: var(--muted, #4f5b5e); margin: 0.25rem 0; }
`;

const html = `
    <p class="dash-sub">Shoots, edits, posts and delivery — pick where you are going.</p>
    <section class="dash-panel dash-panel-teal" id="dash-stats">
      <div class="dash-panel-head"><h2>At a glance</h2><p class="dash-panel-sub">Live counts from the CRM, HD Photo Hub sites, post drafts and recent batches.</p></div>
      <div class="dash-panel-body"><div class="dash-tiles">
        <div class="dash-tile"><b id="dash-stat-shoots">—</b><span>Shoots in the CRM</span></div>
        <div class="dash-tile"><b id="dash-stat-sites">—</b><span>HD Photo Hub sites</span></div>
        <div class="dash-tile"><b id="dash-stat-batches">—</b><span>Batches run</span></div>
        <div class="dash-tile"><b id="dash-stat-files">—</b><span>Approved files</span></div>
        <div class="dash-tile"><b id="dash-stat-drafts">—</b><span>Post drafts waiting</span></div>
        <div class="dash-tile"><b id="dash-stat-pending">—</b><span>Approved, still to post</span></div>
      </div></div>
    </section>
    <section class="dash-panel dash-panel-blue" id="dash-quick">
      <div class="dash-panel-head"><h2>Quick Start</h2><p class="dash-panel-sub">The three things you do most.</p></div>
      <div class="dash-panel-body"><div class="dash-quick">
        <a href="/staff/crm">New shoot</a>
        <a href="/staff/studio">Open Studio</a>
        <a href="/staff/posts">Write posts</a>
      </div></div>
    </section>
    <section class="dash-panel dash-panel-pink" id="dash-needs">
      <div class="dash-panel-head"><h2>Needs doing</h2><p class="dash-panel-sub">From shoot statuses in the CRM. “Scheduled” means shot, edit not started yet. “Completed” means editing, or ready to send.</p></div>
      <div class="dash-panel-body">
        <h3 class="dash-section" style="margin:0 0 0.5rem">Needs to be Scheduled</h3>
        <ul class="dash-rows" id="dash-scheduled"><li><span>Loading…</span></li></ul>
        <h3 class="dash-section" style="margin:1.25rem 0 0.5rem">Needs to be Completed</h3>
        <ul class="dash-rows" id="dash-complete"><li><span>Loading…</span></li></ul>
      </div>
    </section>
    <section class="dash-panel dash-panel-grey" id="dash-recent">
      <div class="dash-panel-head"><h2>Recent shoots</h2><p class="dash-panel-sub">Latest in the CRM — open one on the CRM page to work on it.</p></div>
      <div class="dash-panel-body"><ul class="dash-rows" id="dash-recent-list"><li><span>Loading…</span></li></ul></div>
    </section>
    <section class="dash-panel dash-panel-teal" id="dash-clients">
      <div class="dash-panel-head"><h2>Top clients</h2><p class="dash-panel-sub">Agents ranked by shoots in the CRM.</p></div>
      <div class="dash-panel-body"><ul class="dash-rows" id="dash-clients-list"><li><span>Loading…</span></li></ul></div>
    </section>
    ${guides.html}
`;

function client() {
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k === 'href') n.setAttribute('href', v); else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  const set = (id, t) => { const n = $(id); if (n) n.textContent = t; };
  const empty = (id, text) => { $(id).replaceChildren(el('li', {}, [el('span', { text })])); };
  const shootLink = s => el('a', { href: '/staff/crm', text: `${s.address}, ${s.city}` });
  const row = (s, extra) => el('li', {}, [
    shootLink(s),
    el('span', { text: `${s.agentName || '—'} · ${s.package} · shot ${s.shotDate || ''}` }),
    el('span', { class: 'dash-pill', text: s.status }),
  ].concat(extra || []));

  async function get(path) {
    const r = await fetch(location.origin + path);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }

  // Delivery shoots drive the needs lists, recent shoots and top clients.
  get('/staff/delivery?action=shoots').then(list => {
    const shoots = Array.isArray(list) ? list : [];
    set('dash-stat-shoots', String(shoots.length));
    set('dash-stat-files', String(shoots.reduce((t, s) => t + (((s.files || {}).edited || []).length), 0)));
    const scheduled = shoots.filter(s => s.status === 'shot');
    const complete = shoots.filter(s => s.status === 'editing' || s.status === 'ready');
    if (scheduled.length) $('dash-scheduled').replaceChildren(...scheduled.map(s => row(s)));
    else empty('dash-scheduled', 'Nothing waiting to be scheduled.');
    if (complete.length) $('dash-complete').replaceChildren(...complete.map(s => row(s)));
    else empty('dash-complete', 'Nothing waiting to be completed.');
    const recent = [...shoots].sort((a, b) => String(b.shotDate).localeCompare(String(a.shotDate))).slice(0, 5);
    if (recent.length) $('dash-recent-list').replaceChildren(...recent.map(s => row(s)));
    else empty('dash-recent-list', 'No shoots yet.');
    const byAgent = new Map();
    for (const s of shoots) {
      const name = (s.agentName || '').trim();
      if (!name) continue;
      const cur = byAgent.get(name) || { name, count: 0, phone: '' };
      cur.count += 1;
      if (!cur.phone && s.agentPhone) cur.phone = s.agentPhone;
      byAgent.set(name, cur);
    }
    const top = [...byAgent.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    if (top.length) $('dash-clients-list').replaceChildren(...top.map((c, i) => el('li', {}, [
      el('span', { text: `${i + 1}.` }),
      el('span', { text: c.name + (c.phone ? ` · ${c.phone}` : '') }),
      el('span', { class: 'dash-pill', text: `${c.count} shoot${c.count === 1 ? '' : 's'}` }),
    ])));
    else empty('dash-clients-list', 'No clients yet.');
  }).catch(() => {
    empty('dash-scheduled', 'Could not load shoots.');
    empty('dash-complete', 'Could not load shoots.');
    empty('dash-recent-list', 'Could not load shoots.');
    empty('dash-clients-list', 'Could not load shoots.');
  });

  // HD sites and post drafts: each on its own, so one failure never takes
  // out the others, and a failed number just stays a dash.
  get('/staff/shoots?action=sites').then(sites => {
    set('dash-stat-sites', String(Array.isArray(sites) ? sites.length : 0));
  }).catch(() => {});
  get('/staff/shoots?action=drafts').then(d => {
    set('dash-stat-drafts', String((d.drafts || []).length));
    set('dash-stat-pending', String((d.pending || []).length));
  }).catch(() => {});
  get('/staff/recipes?action=batches').then(b => {
    set('dash-stat-batches', String(Array.isArray(b) ? b.length : 0));
  }).catch(() => {});
}

const opts = {
  title: 'Team Dashboard', heading: 'Welcome to your account, William', active: 'Dashboard',
  css: [css], body: html, scripts: [`(${client.toString()})();`],
};

function page() { return staffPage(opts); }

module.exports = async (req, res) => serveStaffPage(req, res, '/staff', opts);
module.exports.page = page;
