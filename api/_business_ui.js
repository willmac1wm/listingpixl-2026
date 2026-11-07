// Business Summary page content for /staff/business: business name,
// owner, website and domains from the existing config, stat panels
// counted from endpoints that already exist, and Team Members (William
// and Listing Pixl). HD's other 19 Business sidebar items are NOT built
// — there is no data or function behind them here, and the sidebar
// lists only what exists. No created date: it is not in our data, and
// no date is invented.
const css = `
    .bs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
    .bs-tile { background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; padding: 0.9rem 1rem; text-align: center; }
    .bs-tile b { display: block; font-size: 2rem; font-weight: 800; line-height: 1.1; color: var(--dash-tone, #0c7a8c); }
    .bs-tile span { font-size: 0.9rem; color: var(--muted, #4f5b5e); }
    .bs-defs { display: grid; grid-template-columns: 160px 1fr; gap: 0.4rem 1rem; margin: 0; }
    .bs-defs dt { font-weight: 800; }
    .bs-defs dd { margin: 0; }
    .bs-team { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
    .bs-member { background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; padding: 1rem 1.1rem; }
    .bs-member strong { display: block; font-size: 1.05rem; }
    .bs-member span { font-size: 0.9rem; color: var(--muted, #4f5b5e); }
    .bs-msg { color: var(--muted, #4f5b5e); margin: 0.25rem 0; }
`;

const html = `
    <section class="dash-panel dash-panel-teal" id="business-summary">
      <div class="dash-panel-head"><h2>Business Summary</h2><p class="dash-panel-sub">The business, as it is set up in this app.</p></div>
      <div class="dash-panel-body">
        <dl class="bs-defs">
          <dt>Business Name</dt><dd>Listing Pixl</dd>
          <dt>Business Owner</dt><dd>William Macomber</dd>
          <dt>Website</dt><dd><a href="https://listingpixl.com" target="_blank" rel="noopener noreferrer">listingpixl.com</a></dd>
          <dt>Domains</dt><dd>listingpixl.com, listingpixl.hd.pics</dd>
          <dt>HD Photo Hub</dt><dd><a href="https://listingpixl.hd.pics/ux/studio/Dashboard" target="_blank" rel="noopener noreferrer">Open the HD admin</a></dd>
        </dl>
      </div>
    </section>
    <section class="dash-panel dash-panel-blue" id="business-stats">
      <div class="dash-panel-head"><h2>Stats</h2><p class="dash-panel-sub">Live counts from the CRM, HD Photo Hub sites and recent batches.</p></div>
      <div class="dash-panel-body"><div class="bs-grid">
        <div class="bs-tile"><b id="bs-stat-sites">—</b><span>HD Photo Hub sites</span></div>
        <div class="bs-tile"><b id="bs-stat-shoots">—</b><span>Shoots in the CRM</span></div>
        <div class="bs-tile"><b id="bs-stat-clients">—</b><span>Clients</span></div>
        <div class="bs-tile"><b id="bs-stat-files">—</b><span>Approved files</span></div>
        <div class="bs-tile"><b id="bs-stat-batches">—</b><span>Batches run</span></div>
      </div>
      <p class="bs-msg" id="bs-status">Loading stats…</p></div>
    </section>
    <section class="dash-panel dash-panel-pink" id="business-team">
      <div class="dash-panel-head"><h2>Team Members</h2><p class="dash-panel-sub">Who can sign in to the team dashboard.</p></div>
      <div class="dash-panel-body"><div class="bs-team">
        <div class="bs-member"><strong>Listing Pixl</strong><span>Owner</span></div>
        <div class="bs-member"><strong>William Macomber</strong><span>Owner</span></div>
      </div></div>
    </section>
`;

function client() {
  const $ = id => document.getElementById(id);
  const set = (id, t) => { const n = $(id); if (n) n.textContent = t; };
  async function get(path) {
    const r = await fetch(location.origin + path);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }
  let loaded = 0;
  const done = () => { loaded += 1; if (loaded >= 3) $('bs-status').textContent = 'Stats are live counts — a dash means that source did not load.'; };
  // Clients is the union of agent names from HD sites and the CRM, so
  // an agent known from either list counts once.
  const clientNames = new Set();
  const addNames = list => {
    for (const n of list) {
      const name = (n || '').trim().toLowerCase();
      if (name) clientNames.add(name);
    }
    set('bs-stat-clients', String(clientNames.size));
  };
  get('/staff/shoots?action=sites').then(sites => {
    const list = Array.isArray(sites) ? sites : [];
    set('bs-stat-sites', String(list.length));
    addNames(list.map(s => s.agent));
  }).catch(() => {}).finally(done);
  get('/staff/delivery?action=shoots').then(list => {
    const shoots = Array.isArray(list) ? list : [];
    set('bs-stat-shoots', String(shoots.length));
    set('bs-stat-files', String(shoots.reduce((t, s) => t + (((s.files || {}).edited || []).length), 0)));
    addNames(shoots.map(s => s.agentName));
  }).catch(() => {}).finally(done);
  get('/staff/recipes?action=batches').then(b => {
    set('bs-stat-batches', String(Array.isArray(b) ? b.length : 0));
  }).catch(() => {}).finally(done);
}

module.exports = {
  css, html,
  script: `(${client.toString()})();`,
};
