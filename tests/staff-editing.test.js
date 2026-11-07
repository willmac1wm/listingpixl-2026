// Editing queue (Nov 2026): the little editing section around the
// Recipe Studio — per-shoot queue, status to-edit / editing / done, who
// is doing the editing, due time with a late flag. A tracker only:
// creating a job or moving it starts nothing, runs nothing, charges
// nothing. No kanban, no QC rounds, no payroll.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const editing = require('../lib/editing');
const handler = require('../api/staff-delivery');
const store = require('../lib/private-store');
const editingPage = require('../api/_pages/editing');

const headers = extra => ({ host: 'www.listingpixl.com', ...extra });
function response() {
  const saved = new Map();
  return { statusCode: 200, headersSent: false, body: '',
    setHeader(key, value) { saved.set(key.toLowerCase(), value); },
    getHeader(key) { return saved.get(key.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}
const basic = () => 'Basic ' + Buffer.from('team:LOCAL-TEST-ONLY-not-an-account-password').toString('base64');

function memoryStore() {
  const objects = new Map();
  const original = { create: store.create, read: store.read, write: store.write, list: store.list, remove: store.remove };
  store.create = async (path, value) => { const created = !objects.has(path); if (created) objects.set(path, { value, etag: 'e1' }); return { value: objects.get(path).value, etag: 'e1', created }; };
  store.read = async path => objects.has(path) ? { value: objects.get(path).value, etag: 'e1' } : null;
  store.write = async (path, value) => { objects.set(path, { value, etag: 'e2' }); return { value, etag: 'e2' }; };
  store.list = async prefix => ({ items: [...objects.keys()].filter(k => k.startsWith(prefix)).map(path => ({ path, uploadedAt: new Date().toISOString() })), cursor: null });
  store.remove = async path => { objects.delete(path); };
  return () => Object.assign(store, original);
}

async function call(action, body, authed = true) {
  const res = response();
  const auth = authed ? { authorization: basic(), 'x-staff': '1', 'content-type': 'application/json' } : {};
  await handler({ method: body ? 'POST' : 'GET', url: `/staff/delivery?action=${action}`, headers: headers(auth), body: body ? JSON.stringify(body) : undefined }, res);
  return res;
}

test('a new editing job starts to-edit with a hex id, and the assignee can be William, AutoHDR, Aura, or a named human', () => {
  const job = editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', space: 'front yard', assignee: 'William', due: '2026-11-07T18:00', notes: 'lawn is dirt' });
  assert.match(job.id, /^[a-f0-9]{16}$/);
  assert.equal(job.status, 'to-edit');
  assert.equal(job.assignee, 'William');
  assert.equal(job.due, '2026-11-07T18:00:00.000Z');
  assert.equal(job.space, 'front yard');
  for (const assignee of ['AutoHDR', 'Aura']) {
    assert.equal(editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee }).assignee, assignee);
  }
  assert.equal(editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: 'Other', assigneeName: 'Sam the editor' }).assignee, 'Sam the editor');
  assert.equal(editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: 'Other', assigneeName: '' }).assignee, 'Other');
  assert.throws(() => editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: '' }), /who is doing the editing/);
  assert.throws(() => editing.newEditingJob({ slug: 'not a slug!', assignee: 'William' }), /Bad shoot slug/);
  assert.throws(() => editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: 'William', due: 'not a date' }), /not a date/);
  // No due date is fine — the job just never goes late.
  assert.equal(editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: 'Aura' }).due, '');
});

test('late means past due and not done; done jobs and dateless jobs are never late', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const base = { id: 'a'.repeat(16), slug: '114-e-anna-st-whitesboro-nj', space: '', assignee: 'William', notes: '', createdAt: '', updatedAt: '' };
  assert.equal(editing.isLate({ ...base, status: 'to-edit', due: '2026-11-07T11:00:00.000Z' }, now), true);
  assert.equal(editing.isLate({ ...base, status: 'editing', due: '2026-11-07T11:00:00.000Z' }, now), true);
  assert.equal(editing.isLate({ ...base, status: 'done', due: '2026-11-07T11:00:00.000Z' }, now), false);
  assert.equal(editing.isLate({ ...base, status: 'to-edit', due: '2026-11-07T13:00:00.000Z' }, now), false);
  assert.equal(editing.isLate({ ...base, status: 'to-edit', due: '' }, now), false);
});

test('the queue sorts soonest-due-first, dateless jobs last', () => {
  const mk = (due, createdAt) => ({ id: 'a'.repeat(16), slug: 's', status: 'to-edit', assignee: 'William', due, createdAt });
  const sorted = editing.sortJobs([
    mk('', '2026-11-07T10:00:00Z'),
    mk('2026-11-09T09:00:00Z', '2026-11-07T10:00:00Z'),
    mk('2026-11-07T18:00:00Z', '2026-11-07T10:00:00Z'),
    mk('2026-11-07T09:00:00Z', '2026-11-07T10:00:00Z'),
  ]);
  assert.deepEqual(sorted.map(j => j.due), ['2026-11-07T09:00:00Z', '2026-11-07T18:00:00Z', '2026-11-09T09:00:00Z', '']);
  assert.deepEqual(editing.sortJobs([]), []);
});

test('status moves go to-edit → editing → done, and a bad status or unknown job is refused', () => {
  const job = editing.newEditingJob({ slug: '114-e-anna-st-whitesboro-nj', assignee: 'AutoHDR' });
  const editingJob = editing.applyEditingJobEdits(job, { status: 'editing' });
  assert.equal(editingJob.status, 'editing');
  assert.equal(editing.applyEditingJobEdits(editingJob, { status: 'done' }).status, 'done');
  assert.throws(() => editing.applyEditingJobEdits(job, { status: 'shipped' }), /Bad editing status/);
  assert.throws(() => editing.applyEditingJobEdits(job, { status: '' }), /Bad editing status/);
});

test('editing queue API: needs team login, create → move → list works, late flag is computed', async () => {
  const restoreStore = memoryStore();
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  try {
    const anon = await call('editingJobs', null, false);
    assert.equal(anon.statusCode, 401);

    const created = await call('createEditingJob', { slug: '114-e-anna-st-whitesboro-nj', space: 'front yard', assignee: 'Aura', due: '2020-01-01T09:00', notes: 'lawn is dirt' });
    assert.equal(created.statusCode, 200);
    const job = JSON.parse(created.body);
    assert.equal(job.status, 'to-edit');
    assert.equal(job.late, true); // due in the past, not done

    const listed = await call('editingJobs');
    assert.equal(listed.statusCode, 200);
    const jobs = JSON.parse(listed.body);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, job.id);

    const moved = await call('moveEditingJob', { id: job.id, status: 'editing' });
    assert.equal(moved.statusCode, 200);
    assert.equal(JSON.parse(moved.body).status, 'editing');

    const done = await call('moveEditingJob', { id: job.id, status: 'done' });
    assert.equal(done.statusCode, 200);
    const doneJob = JSON.parse(done.body);
    assert.equal(doneJob.status, 'done');
    assert.equal(doneJob.late, false); // done jobs are never late

    // A second job due later sorts after the first when both are open.
    const second = await call('createEditingJob', { slug: '1-main-st-villas-nj', space: 'kitchen', assignee: 'William', due: '2999-01-01T09:00' });
    assert.equal(second.statusCode, 200);
    const all = JSON.parse((await call('editingJobs')).body);
    assert.equal(all.length, 2);
    assert.equal(all[0].slug, '114-e-anna-st-whitesboro-nj');
    assert.equal(all[1].slug, '1-main-st-villas-nj');

    const badSlug = await call('createEditingJob', { slug: 'not a slug!', assignee: 'William' });
    assert.equal(badSlug.statusCode, 400);
    const badStatus = await call('moveEditingJob', { id: job.id, status: 'shipped' });
    assert.equal(badStatus.statusCode, 400);
    const unknown = await call('moveEditingJob', { id: 'f'.repeat(16), status: 'editing' });
    assert.equal(unknown.statusCode, 404);
    const noHeader = response();
    await handler({ method: 'POST', url: '/staff/delivery?action=createEditingJob', headers: headers({ authorization: basic(), 'content-type': 'application/json' }), body: JSON.stringify({ slug: 'x-nj', assignee: 'William' }) }, noHeader);
    assert.equal(noHeader.statusCode, 403);
  } finally {
    restoreStore();
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});

test('editing page holds the queue, the new-job form and the recent batches — and starts nothing', () => {
  const html = editingPage.page();
  assert.match(html, /<h2>Editing queue<\/h2>/);
  assert.match(html, /Tracker only\./);
  assert.match(html, /id="ed-slug"/);
  assert.match(html, /id="ed-assignee"/);
  assert.match(html, /id="ed-due"/);
  assert.match(html, /Add to the queue/);
  assert.match(html, /id="ed-queue"/);
  assert.match(html, /<h2>Recent batches<\/h2>/);
  assert.match(html, /id="ed-batch-list"/);
  // The queue loads from the delivery API, batches from the Studio API
  // (the action name is joined to the base URL at runtime in the script).
  assert.match(html, /\/staff\/delivery\?action=/);
  assert.match(html, /editingJobs/);
  assert.match(html, /\/staff\/recipes\?action=/);
  assert.match(html, /'batches'/);
  // Nothing on this page runs a batch or charges anything.
  assert.doesNotMatch(html, /Run batch/);
  assert.doesNotMatch(html, /runBatch/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /id="delivery"/);
});
