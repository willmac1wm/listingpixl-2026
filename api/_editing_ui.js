// Editing queue panel for /staff/editing. Plain browser JS; every value
// from the API is put on the page as text, never as HTML.
//
// The Recipe Studio is the tool that edits the photos. This page is only
// the tracker around it: per-shoot queue, status to-edit / editing /
// done, who is doing the editing, due time with a late flag. Creating a
// job or moving its status starts nothing — there is no edit run and no
// payment on this page.
const css = `
    .ed-box { border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); padding: 1rem 1.1rem; margin: 0.75rem 0; }
    .ed-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .ed-box select, .ed-box input, .ed-box textarea { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid #cfc8b8; border-radius: 8px; background: #fff; color: #1d1d1d; max-width: 100%; }
    .ed-box textarea { width: 100%; min-height: 3rem; box-sizing: border-box; }
    .ed-box label { font-size: 0.9rem; display: block; margin: 0.4rem 0 0.15rem; }
    .ed-btn { font: inherit; border: 0; border-radius: 999px; padding: 0.5rem 1.1rem; cursor: pointer; background: #1d1d1d; color: #fff; }
    .ed-btn.pink { background: var(--accent-pink, #d63384); }
    .ed-btn.ghost { background: transparent; color: #1d1d1d; border: 1px solid #cfc8b8; }
    .ed-btn:disabled { opacity: 0.5; cursor: wait; }
    .ed-msg { font-size: 0.95rem; color: var(--muted, #555); margin: 0.4rem 0 0; }
    .ed-err { color: #b00020; }
    .ed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem; }
    .ed-job { background: #fff; border: 1px solid #9fd3da; border-radius: 12px; padding: 1rem 1.1rem; margin: 0 0 0.75rem; }
    .ed-job h3 { margin: 0 0 0.25rem; font-size: 1.15rem; font-weight: 800; line-height: 1.2; text-align: left; }
    .ed-job p { margin: 0.25rem 0; font-size: 0.95rem; color: var(--muted, #555); }
    .ed-job p strong { color: var(--ink, #1d1d1d); }
    .ed-job-done { border-color: #bfc3bd; opacity: 0.75; }
    .ed-pill { display: inline-block; font-size: 0.8rem; font-weight: 700; padding: 0.15rem 0.6rem; border-radius: 999px; }
    .ed-pill-to-edit { background: #d5eef1; color: #0c7a8c; }
    .ed-pill-editing { background: #d6e7ff; color: #0060cc; }
    .ed-pill-done { background: #e2e3df; color: #14262b; }
    .ed-pill-late { background: #b00020; color: #fff; }
    .ed-job-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .ed-job-head h3 { flex: 1; min-width: 12rem; }
    .ed-note { background: #f0f9fa; border: 1px solid #9fd3da; border-radius: 10px; padding: 0.65rem 0.85rem; font-size: 0.95rem; margin: 0 0 0.75rem; }
`;

const html = `
    <section class="dash-panel dash-panel-teal" id="editing-queue">
      <div class="dash-panel-head"><h2>Editing queue</h2><p class="dash-panel-sub">What's waiting to be edited, who's on it, and what's late — soonest due first.</p></div>
      <div class="dash-panel-body">
      <p class="ed-note"><strong>Tracker only.</strong> Creating a job or moving it never starts an edit and never charges anything. The editing itself happens in the <a href="/staff/studio">Recipe Studio</a>.</p>
      <div class="ed-box" id="ed-new">
        <h3 style="margin:0 0 .25rem;font-size:1.15rem;font-weight:800">New editing job</h3>
        <div class="ed-grid">
          <label>Shoot slug <input id="ed-slug" placeholder="114-e-anna-st-whitesboro-nj"></label>
          <label>Space <input id="ed-space" placeholder="front yard"></label>
          <label>Who is editing
            <select id="ed-assignee"><option>William</option><option>AutoHDR</option><option>Aura</option><option value="Other">Someone else…</option></select>
          </label>
          <label id="ed-other-wrap" hidden>Editor name <input id="ed-other" placeholder="Editor's name"></label>
          <label>Due <input id="ed-due" type="datetime-local"></label>
        </div>
        <label>Notes <textarea id="ed-notes" placeholder="What needs doing — e.g. lawn is dirt, kitchen needs staging"></textarea></label>
        <div class="ed-row" style="margin-top:.5rem"><button class="ed-btn pink" id="ed-create-go" type="button">Add to the queue</button></div>
        <p class="ed-msg" id="ed-status" role="status"></p>
        <p class="ed-msg ed-err" id="ed-error" role="alert"></p>
      </div>
      <div id="ed-queue"><p class="ed-msg">Loading queue…</p></div>
      </div>
    </section>
    <section class="dash-panel dash-panel-grey" id="ed-batches">
      <div class="dash-panel-head"><h2>Recent batches</h2><p class="dash-panel-sub">What the Recipe Studio has run lately — read-only here.</p></div>
      <div class="dash-panel-body">
      <div id="ed-batch-list"><p class="ed-msg">Loading…</p></div>
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
    const r = await fetch(location.origin + '/staff/delivery?action=' + action, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Staff': '1' }, body: JSON.stringify(body),
    } : {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  async function recipesApi(action) {
    const r = await fetch(location.origin + '/staff/recipes?action=' + action, {});
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
  const err = e => { $('ed-error').textContent = e.message; };
  const status = t => { $('ed-status').textContent = t; $('ed-error').textContent = ''; };

  const STATUS_LABEL = { 'to-edit': 'To edit', editing: 'Editing', done: 'Done' };
  const dueText = job => job.due ? new Date(job.due).toLocaleString() : 'No due date';

  function jobCard(job) {
    const card = el('article', { class: 'ed-job' + (job.status === 'done' ? ' ed-job-done' : '') });
    const head = el('div', { class: 'ed-job-head' }, [
      el('h3', { text: `${job.slug}${job.space ? ' · ' + job.space : ''}` }),
      el('span', { class: 'ed-pill ed-pill-' + job.status, text: STATUS_LABEL[job.status] || job.status }),
    ]);
    if (job.late) head.append(el('span', { class: 'ed-pill ed-pill-late', text: 'LATE' }));
    card.append(head);
    card.append(el('p', {}, [el('strong', { text: 'Who: ' }), document.createTextNode(job.assignee)]));
    card.append(el('p', {}, [el('strong', { text: 'Due: ' }), document.createTextNode(dueText(job))]));
    if (job.notes) card.append(el('p', {}, [el('strong', { text: 'Notes: ' }), document.createTextNode(job.notes)]));
    const row = el('div', { class: 'ed-row', style: 'margin-top:.5rem' });
    if (job.status === 'to-edit') {
      const b = el('button', { class: 'ed-btn', type: 'button', text: 'Start editing' });
      b.addEventListener('click', () => moveJob(job, 'editing', b));
      row.append(b);
    } else if (job.status === 'editing') {
      const b = el('button', { class: 'ed-btn pink', type: 'button', text: 'Mark done' });
      b.addEventListener('click', () => moveJob(job, 'done', b));
      row.append(b);
    } else {
      const a = el('a', { class: 'ed-btn ghost', href: '/staff/crm', text: 'Approved files in CRM →' });
      row.append(a);
      const b = el('button', { class: 'ed-btn ghost', type: 'button', text: 'Reopen' });
      b.addEventListener('click', () => moveJob(job, 'to-edit', b));
      row.append(b);
    }
    card.append(row);
    return card;
  }

  async function moveJob(job, nextStatus, btn) {
    btn.disabled = true;
    try {
      await api('moveEditingJob', { id: job.id, status: nextStatus });
      status(`Moved ${job.slug} to ${STATUS_LABEL[nextStatus]}.`);
      await loadQueue();
    } catch (e) { err(e); btn.disabled = false; }
  }

  async function loadQueue() {
    try {
      const jobs = await api('editingJobs');
      const open = jobs.filter(j => j.status !== 'done');
      const done = jobs.filter(j => j.status === 'done');
      const wrap = $('ed-queue');
      wrap.replaceChildren();
      if (!jobs.length) {
        wrap.append(el('p', { class: 'ed-msg', text: 'Queue is empty — add a job above.' }));
      } else {
        if (open.length) wrap.append(...open.map(jobCard));
        else wrap.append(el('p', { class: 'ed-msg', text: 'Nothing waiting — everything is done.' }));
        if (done.length) {
          wrap.append(el('h3', { style: 'margin:1rem 0 .5rem;font-size:1.15rem;font-weight:800', text: 'Done' }));
          wrap.append(...done.map(jobCard));
        }
      }
    } catch (e) {
      $('ed-queue').replaceChildren(el('p', { class: 'ed-msg ed-err', text: 'Could not load the queue: ' + e.message }));
    }
  }

  async function loadBatches() {
    try {
      const list = await recipesApi('batches');
      $('ed-batch-list').replaceChildren(...(list.length ? list.map(b => el('p', { class: 'ed-msg', text: `${b.space} · ${b.recipeId} · ${b.status} · ${new Date(b.createdAt).toLocaleString()}${b.approvedFiles ? ' · ' + b.approvedFiles.length + ' approved' : ''}` })) : [el('p', { class: 'ed-msg', text: 'No batches yet.' })]));
    } catch (e) { $('ed-batch-list').replaceChildren(el('p', { class: 'ed-msg ed-err', text: 'Loading batches failed: ' + e.message })); }
  }

  $('ed-assignee').addEventListener('change', () => {
    $('ed-other-wrap').hidden = $('ed-assignee').value !== 'Other';
  });
  $('ed-create-go').addEventListener('click', async () => {
    const btn = $('ed-create-go');
    btn.disabled = true;
    try {
      const job = await api('createEditingJob', {
        slug: $('ed-slug').value.trim(),
        space: $('ed-space').value.trim(),
        assignee: $('ed-assignee').value,
        assigneeName: $('ed-other').value.trim(),
        due: $('ed-due').value,
        notes: $('ed-notes').value.trim(),
      });
      status(`Added ${job.slug} to the queue.`);
      $('ed-slug').value = ''; $('ed-space').value = ''; $('ed-other').value = ''; $('ed-due').value = ''; $('ed-notes').value = '';
      await loadQueue();
    } catch (e) { err(e); }
    btn.disabled = false;
  });

  loadQueue();
  loadBatches();
}

module.exports = { css, html, script: `(${client})();` };
