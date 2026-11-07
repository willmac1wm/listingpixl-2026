// AI Clips API for /staff: turn a finished listing photo (or two, for a
// transition) into a short camera-move video on fal.ai. Same team login
// as /staff; writes need the X-Staff header.
//
// Key: FAL_KEY Vercel environment variable ONLY. Never in the repo, never
// saved through the page, never returned or logged. No key = the Clips
// panel says so and nothing can be sent, so nothing is spent.
//
// Flow: make → photos are stored in public Blob (fal fetches them by URL;
// they are finished listing photos that get published anyway) → the clip
// is queued on fal → the page asks check every few seconds → when done,
// check returns the video URL. Each make is one paid clip.
const { authorized } = require('./_auth');
const blobStore = require('@vercel/blob');
// Swappable in tests so no test ever writes to real Blob.
const deps = { put: (...args) => blobStore.put(...args) };
const clips = require('../lib/clips');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function decode(img, label) {
  if (!img) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img.dataUrl || ''));
  if (!m) throw new HttpError(400, `${label} is not a JPEG/PNG/WebP photo.`);
  const buffer = Buffer.from(m[2], 'base64');
  return { name: String(img.name || 'photo.jpg').slice(0, 120), mime: m[1], buffer, bytes: buffer.length };
}

async function upload(img) {
  const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg';
  const blob = await deps.put(`listingpixl/clips/source/photo.${ext}`, img.buffer, { access: 'public', contentType: img.mime, addRandomSuffix: true });
  return blob.url;
}

async function fal(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Key ${process.env.FAL_KEY}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  if (!r.ok) throw new HttpError(502, `fal.ai: ${r.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new HttpError(502, 'fal.ai sent an unreadable answer.'); }
}

const needKey = () => { if (!process.env.FAL_KEY) throw new HttpError(503, 'No fal.ai key configured. Add FAL_KEY in Vercel > Settings > Environment Variables, then redeploy.'); };

const actions = {
  async status() {
    return { configured: Boolean(process.env.FAL_KEY), model: clips.MODEL, cost: clips.COST, moves: clips.listMoves() };
  },

  async make(body) {
    const start = decode(body.start, 'Start photo');
    const end = decode(body.end, 'End photo');
    const duration = Number(body.duration);
    try { clips.validateClip({ move: body.move, duration, start, end }); }
    catch (e) { throw new HttpError(400, e.message); }
    needKey();
    const startUrl = await upload(start);
    const endUrl = end ? await upload(end) : null;
    const input = clips.buildInput({ move: body.move, duration, startUrl, endUrl });
    const queued = await fal(`https://queue.fal.run/${clips.MODEL}`, { method: 'POST', body: JSON.stringify(input) });
    if (!clips.REQUEST_ID.test(String(queued.request_id || ''))) throw new HttpError(502, 'fal.ai did not queue the clip.');
    return { ok: true, requestId: queued.request_id, cost: clips.cost(duration) };
  },

  async check(body, query) {
    const id = String(query.get('id') || '');
    if (!clips.REQUEST_ID.test(id)) throw new HttpError(400, 'Bad clip id.');
    needKey();
    const s = await fal(clips.statusUrl(id));
    if (s.status !== 'COMPLETED') return { status: s.status === 'IN_PROGRESS' ? 'running' : 'queued' };
    const result = await fal(clips.resultUrl(id));
    const url = result?.video?.url;
    if (!/^https:\/\//.test(String(url || ''))) throw new HttpError(502, 'The clip finished but fal.ai sent no video.');
    return { status: 'done', videoUrl: url };
  },
};

const POSTS = new Set(['make']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  const query = new URL(req.url, 'http://x').searchParams;
  const action = query.get('action');
  if (!await authorized(req, res)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
    return send(401, { error: 'Team login required.' });
  }
  const isPost = POSTS.has(action);
  if (!actions[action] || (isPost !== (req.method === 'POST'))) return send(400, { error: 'Unknown action.' });
  if (isPost && req.headers['x-staff'] !== '1') return send(403, { error: 'Missing X-Staff header.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    send(200, await actions[action](body || {}, query));
  } catch (e) {
    send(e.status || 500, { error: e.message });
  }
};
module.exports._actions = actions;
module.exports._deps = deps;
