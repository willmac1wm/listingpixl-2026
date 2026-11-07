const { test } = require('node:test');
const assert = require('node:assert/strict');
const clips = require('../lib/clips');
const handler = require('../api/staff-clips');
const ui = require('../api/_clips_ui');

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
const jpeg = name => ({ name, dataUrl: 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64') });
const ID = '764cabcf-b745-4b3e-ae38-1200304cf45b';

async function withEnv(env, fn) {
  const old = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
}

test('clip prices: 5 s is $0.35, 10 s is $0.70 (Kling 2.5 Turbo Pro on fal.ai)', () => {
  assert.equal(clips.MODEL, 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video');
  assert.equal(clips.cost(5), 0.35);
  assert.equal(clips.cost(10), 0.70);
  assert.equal(clips.cost(7), undefined);
});

test('every prompt forbids changing the house; transition needs an end photo', () => {
  for (const m of Object.keys(clips.MOVES)) {
    assert.match(clips.buildPrompt(m), /Do not add, remove or change any object, room, wall or feature/);
    assert.match(clips.buildPrompt(m), /No people/);
  }
  assert.match(clips.NEGATIVE, /extra rooms/);
  const img = { mime: 'image/jpeg', bytes: 100 };
  assert.throws(() => clips.validateClip({ move: 'transition', duration: 5, start: img }), /needs the end photo/);
  assert.throws(() => clips.validateClip({ move: 'push-in', duration: 5, start: img, end: img }), /Only a transition/);
  assert.throws(() => clips.validateClip({ move: 'push-in', duration: 7, start: img }), /5 or 10/);
  assert.throws(() => clips.validateClip({ move: 'zoom-crazy', duration: 5, start: img }), /camera move/);
  assert.throws(() => clips.validateClip({ move: 'push-in', duration: 5 }), /start photo/);
  assert.throws(() => clips.validateClip({ move: 'push-in', duration: 5, start: { mime: 'image/gif', bytes: 1 } }), /JPEG, PNG or WebP/);
  assert.ok(clips.validateClip({ move: 'transition', duration: 10, start: img, end: img }));
});

test('fal input: duration is a string, end frame only on transitions', () => {
  const push = clips.buildInput({ move: 'push-in', duration: 5, startUrl: 'https://x/a.jpg' });
  assert.deepEqual(Object.keys(push).sort(), ['cfg_scale', 'duration', 'image_url', 'negative_prompt', 'prompt']);
  assert.equal(push.duration, '5');
  const tr = clips.buildInput({ move: 'transition', duration: 10, startUrl: 'https://x/a.jpg', endUrl: 'https://x/b.jpg' });
  assert.equal(tr.tail_image_url, 'https://x/b.jpg');
  assert.equal(tr.duration, '10');
  // Status/result URLs use owner/app only, never the full model path (fal returns 405 otherwise).
  assert.equal(clips.statusUrl(ID), `https://queue.fal.run/fal-ai/kling-video/requests/${ID}/status`);
  assert.equal(clips.resultUrl(ID), `https://queue.fal.run/fal-ai/kling-video/requests/${ID}`);
});

test('clips API needs team login and the X-Staff header, and spends nothing without FAL_KEY', async () => {
  await withEnv({ STAFF_PASSWORD: 'LOCAL-TEST-ONLY-not-an-account-password', FAL_KEY: undefined }, async () => {
    let res = response();
    await handler({ method: 'GET', url: '/staff/clips?action=status', headers: headers() }, res);
    assert.equal(res.statusCode, 401);

    res = response();
    await handler({ method: 'POST', url: '/staff/clips?action=make', headers: headers({ authorization: basic() }), body: { move: 'push-in', duration: 5, start: jpeg('a.jpg') } }, res);
    assert.equal(res.statusCode, 403);

    res = response();
    await handler({ method: 'GET', url: '/staff/clips?action=status', headers: headers({ authorization: basic() }) }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).configured, false);

    const oldFetch = global.fetch, oldPut = handler._deps.put;
    let calls = 0;
    global.fetch = async () => { calls++; throw Error('no network in tests'); };
    handler._deps.put = async () => { calls++; return { url: 'https://blob/x.jpg' }; };
    try {
      res = response();
      await handler({ method: 'POST', url: '/staff/clips?action=make', headers: headers({ authorization: basic(), 'x-staff': '1' }), body: { move: 'push-in', duration: 5, start: jpeg('a.jpg') } }, res);
      assert.equal(res.statusCode, 503);
      assert.match(JSON.parse(res.body).error, /FAL_KEY/);
      assert.equal(calls, 0, 'no upload and no fal call without a key');
    } finally { global.fetch = oldFetch; handler._deps.put = oldPut; }
  });
});

test('make queues one clip with the key header; check returns the video when done', async () => {
  await withEnv({ STAFF_PASSWORD: 'LOCAL-TEST-ONLY-not-an-account-password', FAL_KEY: 'test-fal-key' }, async () => {
    const oldFetch = global.fetch, oldPut = handler._deps.put;
    const sent = [];
    handler._deps.put = async (path, buf, opts) => { assert.equal(opts.access, 'public'); assert.equal(opts.addRandomSuffix, true); return { url: `https://blob.example/${sent.length}-${path.split('/').pop()}` }; };
    let done = false;
    global.fetch = async (url, opts = {}) => {
      sent.push({ url, opts });
      assert.equal(opts.headers.Authorization, 'Key test-fal-key');
      if (opts.method === 'POST') return new Response(JSON.stringify({ request_id: ID }));
      if (url.endsWith('/status')) return new Response(JSON.stringify({ status: done ? 'COMPLETED' : 'IN_PROGRESS' }));
      return new Response(JSON.stringify({ video: { url: 'https://v3b.fal.media/files/out.mp4' } }));
    };
    try {
      let res = response();
      await handler({ method: 'POST', url: '/staff/clips?action=make', headers: headers({ authorization: basic(), 'x-staff': '1' }), body: { move: 'transition', duration: 10, start: jpeg('a.jpg'), end: jpeg('b.jpg') } }, res);
      assert.equal(res.statusCode, 200, res.body);
      assert.deepEqual(JSON.parse(res.body), { ok: true, requestId: ID, cost: 0.7 });
      assert.equal(sent.length, 1);
      assert.equal(sent[0].url, 'https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video');
      const input = JSON.parse(sent[0].opts.body);
      assert.equal(input.duration, '10');
      assert.match(input.image_url, /^https:\/\/blob\.example\//);
      assert.match(input.tail_image_url, /^https:\/\/blob\.example\//);

      res = response();
      await handler({ method: 'GET', url: `/staff/clips?action=check&id=${ID}`, headers: headers({ authorization: basic() }) }, res);
      assert.deepEqual(JSON.parse(res.body), { status: 'running' });

      done = true;
      res = response();
      await handler({ method: 'GET', url: `/staff/clips?action=check&id=${ID}`, headers: headers({ authorization: basic() }) }, res);
      assert.deepEqual(JSON.parse(res.body), { status: 'done', videoUrl: 'https://v3b.fal.media/files/out.mp4' });

      res = response();
      await handler({ method: 'GET', url: '/staff/clips?action=check&id=../../etc', headers: headers({ authorization: basic() }) }, res);
      assert.equal(res.statusCode, 400);
    } finally { global.fetch = oldFetch; handler._deps.put = oldPut; }
  });
});

test('Clips panel is on /staff below the Recipe Studio, with the price on the button and no key field', () => {
  const staff = require('../api/staff');
  assert.ok(staff);
  assert.match(ui.html, /id="ai-clips"/);
  assert.match(ui.html, /Make clip/);
  assert.doesNotMatch(ui.html, /type="password"/, 'the fal key lives in Vercel only, never typed into the page');
  assert.match(ui.script, /confirm\(/, 'every clip is confirmed before it is paid for');
  const src = require('node:fs').readFileSync(require.resolve('../api/staff.js'), 'utf8');
  assert.ok(src.indexOf('${recipeStudio.html}') < src.indexOf('${aiClips.html}'));
});
