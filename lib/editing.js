// Editing queue — the little editing section around the Recipe Studio.
//
// The Studio is the tool that edits the photos. This is only the tracker
// around it: per-shoot queue, status to-edit / editing / done, who is
// doing the editing, due time with a late flag. Deliberately small —
// no kanban, no QC rounds, no payroll. Full production tracking is
// overkill until a second editor is hired.
//
// Pure functions only — no I/O, no secrets, nothing runs from here.
// Creating a job does not start an edit; status moves do not either.
// Storage: jobs live in private Vercel Blob via lib/private-store
// (editing/jobs/<id>.json), same pattern as the delivery shoots.
const { randomBytes } = require('node:crypto');
const delivery = require('./delivery');

const STATUSES = ['to-edit', 'editing', 'done'];
// Preset assignees. Anything else is a free-text human editor name.
const ASSIGNEES = ['William', 'AutoHDR', 'Aura'];
const ID = /^[a-f0-9]{16}$/;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

function assigneeFor(body) {
  const pick = clean(body.assignee, 100);
  if (ASSIGNEES.includes(pick)) return pick;
  const other = clean(body.assigneeName, 100);
  if (other) return other;
  // A free-text name typed straight into the assignee field is fine too.
  if (pick) return pick;
  throw Error('Pick who is doing the editing — William, AutoHDR, Aura, or a name.');
}

function dueFor(value) {
  if (!value) return '';
  const t = Date.parse(String(value).trim());
  if (Number.isNaN(t)) throw Error('Due date is not a date.');
  return new Date(t).toISOString();
}

function newEditingJob(body) {
  const slug = clean(body.slug, 120).toLowerCase();
  if (!delivery.SLUG.test(slug)) throw Error('Bad shoot slug — use the shoot slug, e.g. 114-e-anna-st-whitesboro-nj.');
  return {
    id: randomBytes(8).toString('hex'),
    slug,
    space: clean(body.space, 100),
    status: 'to-edit',
    assignee: assigneeFor(body),
    due: dueFor(body.due),
    notes: clean(body.notes, 1000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function validateEditingJob(job) {
  if (!job || !ID.test(job.id || '')) throw Error('Bad editing job id.');
  if (!delivery.SLUG.test(job.slug || '')) throw Error('Bad shoot slug.');
  if (!STATUSES.includes(job.status)) throw Error('Bad editing status.');
  if (!job.assignee) throw Error('Editing job needs an assignee.');
  if (job.due && Number.isNaN(Date.parse(job.due))) throw Error('Due date is not a date.');
  return job;
}

function applyEditingJobEdits(current, body) {
  const next = { ...current, updatedAt: new Date().toISOString() };
  if (body.space !== undefined) next.space = clean(body.space, 100);
  if (body.status !== undefined) next.status = body.status;
  if (body.assignee !== undefined || body.assigneeName !== undefined) next.assignee = assigneeFor(body);
  if (body.due !== undefined) next.due = dueFor(body.due);
  if (body.notes !== undefined) next.notes = clean(body.notes, 1000);
  return validateEditingJob(next);
}

// Late means the due time has passed and the job is not done. A job
// with no due date is never late.
function isLate(job, now = Date.now()) {
  return job.status !== 'done' && Boolean(job.due) && Date.parse(job.due) <= now;
}

// Queue order: soonest due first; jobs with no due date go last.
function sortJobs(jobs) {
  return [...(jobs || [])].sort((a, b) => {
    const da = a.due ? Date.parse(a.due) : Infinity;
    const db = b.due ? Date.parse(b.due) : Infinity;
    if (da !== db) return da - db;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

module.exports = { STATUSES, ASSIGNEES, ID, newEditingJob, validateEditingJob, applyEditingJobEdits, isLate, sortJobs };
