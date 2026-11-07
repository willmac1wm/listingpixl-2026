// Clients page content for /staff/clients: one table built from the two
// lists that actually know agents — delivery shoots in the CRM (name,
// phone, brokerage) and HD Photo Hub sites (name). Columns only for
// data that exists: phone and brokerage come from the CRM only, and show
// a dash when a client is only known from HD. "Create a New Client"
// links OUT to HD Photo Hub — client creation is not rebuilt here.
//
// mergeClients is a pure function, exported so tests can call it
// directly; the browser script gets the same function inlined (see the
// script export at the bottom).
function mergeClients(deliveryShoots, hdSites) {
  const byName = new Map();
  const key = name => (name || '').trim().toLowerCase();
  for (const s of deliveryShoots || []) {
    const name = (s.agentName || '').trim();
    if (!name) continue;
    const cur = byName.get(key(name)) || { name, phone: '', brokerage: '', crmShoots: 0, hdSites: 0 };
    cur.crmShoots += 1;
    if (!cur.phone && s.agentPhone) cur.phone = s.agentPhone;
    if (!cur.brokerage && s.brokerage) cur.brokerage = s.brokerage;
    byName.set(key(name), cur);
  }
  for (const s of hdSites || []) {
    const name = (s.agent || '').trim();
    if (!name) continue;
    const cur = byName.get(key(name)) || { name, phone: '', brokerage: '', crmShoots: 0, hdSites: 0 };
    cur.hdSites += 1;
    byName.set(key(name), cur);
  }
  return [...byName.values()].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

const css = `
    .cl-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
    .cl-toolbar input { font: inherit; padding: 0.5rem 0.7rem; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 8px; background: #fff; flex: 1 1 220px; }
    .cl-new { font: inherit; font-weight: 700; text-decoration: none; color: #fff; background: #14262b; border-radius: 999px; padding: 0.6rem 1.2rem; }
    .cl-new:hover, .cl-new:focus-visible { background: #d71266; }
    .cl-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; overflow: hidden; }
    .cl-table th, .cl-table td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid var(--dash-edge, #cfd6d7); }
    .cl-table th { background: var(--dash-band, #e9eeef); font-weight: 800; }
    .cl-table tr:last-child td { border-bottom: none; }
    .cl-msg { color: var(--muted, #4f5b5e); margin: 0.25rem 0; }
    .cl-err { color: #8d1e3a; margin: 0.25rem 0; }
`;

const html = `
    <section class="dash-panel dash-panel-teal" id="clients">
      <div class="dash-panel-head"><h2>Clients</h2><p class="dash-panel-sub">Agents from the CRM and HD Photo Hub. Phone and brokerage only come from the CRM — a dash means it is not on file.</p></div>
      <div class="dash-panel-body">
        <div class="cl-toolbar">
          <input id="cl-search" type="search" placeholder="Search name, phone or brokerage…" aria-label="Search clients">
          <a class="cl-new" href="https://listingpixl.hd.pics/Clients/search.asp" target="_blank" rel="noopener noreferrer">Create a New Client</a>
        </div>
        <p class="cl-msg" id="cl-status" role="status">Loading clients…</p>
        <p class="cl-err" id="cl-load-err" role="alert"></p>
        <table class="cl-table">
          <thead><tr><th>Client Name</th><th>Phone</th><th>Brokerage</th><th>CRM shoots</th><th>HD sites</th></tr></thead>
          <tbody id="cl-body"></tbody>
        </table>
      </div>
    </section>
`;

function client() {
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  let clients = [];
  function render() {
    const q = ($('cl-search').value || '').trim().toLowerCase();
    const list = clients.filter(c => !q || `${c.name} ${c.phone} ${c.brokerage}`.toLowerCase().includes(q));
    const body = $('cl-body');
    body.replaceChildren();
    $('cl-status').textContent = list.length ? `${list.length} client${list.length === 1 ? '' : 's'}.` : 'No clients match.';
    for (const c of list) {
      body.append(el('tr', {}, [
        el('td', { text: c.name }),
        el('td', { text: c.phone || '—' }),
        el('td', { text: c.brokerage || '—' }),
        el('td', { text: String(c.crmShoots) }),
        el('td', { text: String(c.hdSites) }),
      ]));
    }
  }
  $('cl-search').addEventListener('input', render);
  Promise.allSettled([
    fetch(location.origin + '/staff/delivery?action=shoots').then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    fetch(location.origin + '/staff/shoots?action=sites').then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  ]).then(([delivery, sites]) => {
    const problems = [];
    if (delivery.status === 'rejected') problems.push('CRM shoots');
    if (sites.status === 'rejected') problems.push('HD sites');
    if (problems.length) $('cl-load-err').textContent = 'Could not load: ' + problems.join(' and ') + '. Showing what loaded.';
    clients = mergeClients(delivery.status === 'fulfilled' ? delivery.value : [], sites.status === 'fulfilled' ? sites.value : []);
    render();
  });
}

module.exports = {
  mergeClients, css, html,
  script: `const mergeClients = ${mergeClients.toString()};\n(${client.toString()})();`,
};
