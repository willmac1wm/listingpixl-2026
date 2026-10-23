// Shoot drafts for the team dashboard (/staff): pick an HD Photo Hub shoot,
// review the draft blog and social posts, approve or reject.
//
// The heavy work runs in GitHub Actions (.github/workflows/shoots.yml); this
// endpoint only starts it and reads/writes the draft files through the GitHub
// API. Same team login as /staff.
//
// Vercel env vars: STAFF_PASSWORD, HDPH_API_KEY, GITHUB_TOKEN (fine-grained,
// this repo only, Contents read/write + Actions read), PUBLISH_BRANCH
// (default main: where approved posts are merged; set a test branch on Preview).
const { authorized } = require('./_auth');

const REPO = process.env.GITHUB_REPO || 'willmac1wm/listingpixl-2026';
// Only the production deployment may publish to main. A preview with no
// PUBLISH_BRANCH set must refuse to approve rather than fall back to main.
const BASE = process.env.PUBLISH_BRANCH || (process.env.VERCEL_ENV === 'production' ? 'main' : null);
const EDITABLE = ['facebook', 'instagram', 'google', 'channels'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// GITHUB_TOKEN1 is the name the key was saved under in Vercel for Preview
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN1;

async function gh(path, opts = {}) {
  if (!GITHUB_TOKEN) throw new HttpError(503, 'GITHUB_TOKEN is not set in Vercel.');
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) throw new HttpError(502, `GitHub ${opts.method || 'GET'} ${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

const enc = encodeURIComponent;
const branchPath = b => b.split('/').map(enc).join('/');

async function readJson(path, ref) {
  const f = await gh(`/contents/${path}?ref=${enc(ref)}`, { allow404: true });
  return f && { sha: f.sha, data: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')) };
}

async function writeJson(path, ref, data, sha, message) {
  return gh(`/contents/${path}`, {
    method: 'PUT',
    body: { message, branch: ref, sha, content: Buffer.from(JSON.stringify(data, null, 1) + '\n').toString('base64') },
  });
}

async function headSha(branch) {
  return (await gh(`/git/ref/heads/${branchPath(branch)}`)).object.sha;
}

// A new branch whose only change is one file, created in a single push so the
// workflow sees the file on its first run.
async function requestBranch(name, file, data) {
  const parent = await headSha(BASE);
  const commit = await gh(`/git/commits/${parent}`);
  const tree = await gh('/git/trees', {
    method: 'POST',
    body: { base_tree: commit.tree.sha, tree: [{ path: file, mode: '100644', type: 'blob', content: JSON.stringify(data, null, 1) + '\n' }] },
  });
  const c = await gh('/git/commits', { method: 'POST', body: { message: `Request: ${name}`, tree: tree.sha, parents: [parent] } });
  await gh('/git/refs', { method: 'POST', body: { ref: `refs/heads/${name}`, sha: c.sha } });
}

async function hdphSites() {
  if (!process.env.HDPH_API_KEY) throw new HttpError(503, 'HDPH_API_KEY is not set in Vercel.');
  const r = await fetch('https://listingpixl.hd.pics/api/v1/sites', { headers: { api_key: process.env.HDPH_API_KEY } });
  if (!r.ok) throw new HttpError(502, `HD Photo Hub: ${r.status}`);
  const when = s => { const [d, t, ap] = s.created.split(' '); const [m, day, y] = d.split('/'); let [h, mi, se] = t.split(':').map(Number); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return Date.UTC(y, m - 1, day, h, mi, se); };
  return (await r.json()).map(s => ({
    sid: s.sid,
    created: new Date(when(s)).toISOString().slice(0, 10),
    address: s.address || '', city: s.city || '',
    agent: (s.user && s.user.name) || '',
    photos: s.media.filter(m => m.type === 'still' && !m.hidden).length,
    slug: `${s.address || ''} ${s.city || ''} nj`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  })).sort((a, b) => b.created.localeCompare(a.created));
}

async function previewUrl(sha) {
  // Vercel files its GitHub deployments under the commit SHA, not the branch name
  const deps = await gh(`/deployments?sha=${sha}&per_page=1`);
  if (!deps.length) return null;
  const st = await gh(`/deployments/${deps[0].id}/statuses?per_page=1`);
  return (st[0] && st[0].state === 'success' && st[0].environment_url) || null;
}

const actions = {
  async sites() {
    const [sites, blog, refs] = await Promise.all([
      hdphSites(),
      gh(`/contents/blog?ref=${enc(BASE || 'main')}`),
      gh('/git/matching-refs/heads/shoot/'),
    ]);
    const posted = new Set(blog.map(f => f.name.replace(/\.html$/, '')));
    const drafting = new Set(refs.map(r => r.ref.replace('refs/heads/shoot/', '')));
    return sites.slice(0, 30).map(s => ({ ...s, onBlog: posted.has(s.slug), drafted: drafting.has(s.slug) }));
  },

  async drafts() {
    const refs = await gh('/git/matching-refs/heads/shoot/');
    const drafts = await Promise.all(refs.map(async r => {
      const branch = r.ref.replace('refs/heads/', '');
      const slug = branch.slice('shoot/'.length);
      const [f, preview] = await Promise.all([readJson(`drafts/${enc(slug)}.json`, branch), previewUrl(r.object.sha).catch(() => null)]);
      return f && { ...f.data, branch, preview, photoBase: `https://raw.githubusercontent.com/${REPO}/${branchPath(branch)}/images/` };
    }));
    // Approved shoots with something left to do on the publish branch: social posts
    // waiting or failed, or the Google Business post not yet marked as posted by hand
    const listing = (await gh(`/contents/drafts?ref=${enc(BASE || 'main')}`, { allow404: true })) || [];
    const pending = (await Promise.all(listing.filter(f => f.name.endsWith('.json') && f.name !== 'request.json')
      .map(f => readJson(f.path, BASE || 'main')))).map(f => f && f.data)
      .filter(d => d && (d.status === 'approved' || Object.keys(d.errors || {}).length || (d.google && !d.google.posted_at)))
      .map(d => ({ ...d, photoBase: BASE === 'main' ? 'https://www.listingpixl.com/images/'
        : `https://raw.githubusercontent.com/${REPO}/${branchPath(BASE || 'main')}/images/` }));
    const runs = await gh('/actions/runs?per_page=30&event=push'); // works before the workflow is on main
    const working = runs.workflow_runs
      .filter(w => w.head_branch.startsWith('draft-request/') && (w.status !== 'completed' || w.conclusion === 'failure')
        && Date.now() - Date.parse(w.created_at) < 2 * 86400e3)
      .map(w => ({ sid: w.head_branch.split('/')[1].split('-')[0], status: w.status, conclusion: w.conclusion, url: w.html_url, started: w.created_at }));
    return { base: BASE, drafts: drafts.filter(Boolean), pending, working };
  },

  async draft(body) {
    if (!BASE) throw new HttpError(503, 'PUBLISH_BRANCH is not set for this preview.');
    const sid = String(body.sid || '').replace(/\D/g, '');
    if (!sid) throw new HttpError(400, 'Missing shoot id.');
    const notes = String(body.notes || '').slice(0, 2000);
    await requestBranch(`draft-request/${sid}-${Date.now()}`, 'drafts/request.json', { sid: Number(sid), notes, base: BASE });
    return { ok: true };
  },

  async save(body, extra = {}) {
    const slug = String(body.slug || '');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new HttpError(400, 'Bad slug.');
    const branch = `shoot/${slug}`;
    const f = await readJson(`drafts/${slug}.json`, branch);
    if (!f) throw new HttpError(404, 'That draft is gone (approved or rejected already?).');
    const d = f.data;
    for (const k of EDITABLE) if (body[k] !== undefined) d[k] = body[k];
    Object.assign(d, extra);
    await writeJson(`drafts/${slug}.json`, branch, d, f.sha, `Edit draft: ${slug}`);
    return { ok: true, draft: d };
  },

  async approve(body) {
    if (!BASE) throw new HttpError(503, 'PUBLISH_BRANCH is not set for this preview, so approving is switched off here.');
    const when = body.post_at ? new Date(body.post_at) : new Date();
    if (isNaN(when)) throw new HttpError(400, 'Bad posting time.');
    const { draft } = await actions.save(body, { status: 'approved', post_at: when.toISOString(), approved_at: new Date().toISOString() });
    await gh('/merges', { method: 'POST', body: { base: BASE, head: `shoot/${draft.slug}`, commit_message: `Publish ${draft.address}, ${draft.town} (approved on the team dashboard)` } });
    await gh(`/git/refs/heads/shoot/${draft.slug}`, { method: 'DELETE' });
    if (when <= Date.now() + 60e3) await actions.publishNow();
    return { ok: true, base: BASE };
  },

  async publishNow() {
    if (!BASE) throw new HttpError(503, 'PUBLISH_BRANCH is not set for this preview.');
    const name = `publish-request/${BASE}`;
    if (await gh(`/git/ref/heads/${branchPath(name)}`, { allow404: true })) return { ok: true }; // one already running
    await gh('/git/refs', { method: 'POST', body: { ref: `refs/heads/${name}`, sha: await headSha(BASE) } });
    return { ok: true };
  },

  // Will posts the Google Business update by hand (no API access yet) and ticks it off here
  async googleDone(body) {
    const slug = String(body.slug || '');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new HttpError(400, 'Bad slug.');
    if (!BASE) throw new HttpError(503, 'PUBLISH_BRANCH is not set for this preview.');
    const f = await readJson(`drafts/${slug}.json`, BASE);
    if (!f) throw new HttpError(404, 'That shoot has no draft file.');
    f.data.google = { ...f.data.google, posted_at: new Date().toISOString() };
    await writeJson(`drafts/${slug}.json`, BASE, f.data, f.sha, `Google Business post done by hand: ${slug}`);
    return { ok: true };
  },

  async reject(body) {
    const slug = String(body.slug || '');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new HttpError(400, 'Bad slug.');
    await gh(`/git/refs/heads/shoot/${slug}`, { method: 'DELETE', allow404: true });
    if (body.redo) return actions.draft({ sid: body.sid, notes: body.notes });
    return { ok: true };
  },
};

const POSTS = new Set(['draft', 'save', 'approve', 'reject', 'publishNow', 'googleDone']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (!await authorized(req, res)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
    return send(401, { error: 'Team login required.' });
  }
  const action = new URL(req.url, 'http://x').searchParams.get('action');
  const isPost = POSTS.has(action);
  if (!actions[action] || (isPost !== (req.method === 'POST'))) return send(400, { error: 'Unknown action.' });
  // The browser re-sends the team login on any request to this site, so writes
  // also need a header that other sites' pages can't add (blocks cross-site form posts).
  if (isPost && req.headers['x-staff'] !== '1') return send(403, { error: 'Missing X-Staff header.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    send(200, await actions[action](body || {}));
  } catch (e) {
    send(e.status || 500, { error: e.message });
  }
};

