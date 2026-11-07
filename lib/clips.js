// AI Clips: short camera-move video clips made from FINISHED listing photos.
//
// Provider: fal.ai, pay per clip, no subscription. Two Kling models, picked
// automatically (prices from fal's own model pages, read 2026-11-07):
// - Kling 2.5 Turbo Pro: one photo, or start + end photo. $0.35 for 5 s,
//   $0.07 each extra second (10 s = $0.70). The cheap everyday choice.
// - Kling v4: start + up to 3 middle photos + end photo, so one clip can
//   walk through several rooms in order. $0.157 per second (5 s = $0.79,
//   10 s = $1.57). Used only when middle photos are added.
//
// Rule for every clip: the camera moves, the house does not change. The
// house rules always go LAST in the prompt, after any extra direction
// typed in the prompt box, so a typed instruction cannot override them.
const MODELS = {
  fast: { id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', label: 'Kling 2.5 Turbo Pro', cost: { 5: 0.35, 10: 0.70 } },
  keyframes: { id: 'fal-ai/kling-video/v4/image-to-video', label: 'Kling v4 (multi-photo)', cost: { 5: 0.79, 10: 1.57 } },
};
const QUEUE_APP = 'fal-ai/kling-video'; // status/result URLs use owner/app only
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_MIDDLES = 3;
const MAX_EXTRA = 300;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const KEEP = 'House rules, which always win: keep the house exactly as it is in the photos — same walls, windows, doors, floors, ceilings, cabinets, furniture, fixtures, colours, light and view. Do not add, remove or change any object, room, wall or feature. No people, no animals, no text. Steady, level, slow, smooth real-estate camera move; straight vertical lines.';

const MOVES = {
  'push-in': { label: 'Push in', multi: false, text: 'Slow, smooth dolly push-in straight toward the centre of the scene.' },
  'pull-out': { label: 'Pull out', multi: false, text: 'Slow, smooth dolly pull-back away from the centre of the scene, revealing only what is already in the photo.' },
  'pan-left': { label: 'Pan left', multi: false, text: 'Slow, smooth horizontal camera slide to the left, parallel to the far wall.' },
  'pan-right': { label: 'Pan right', multi: false, text: 'Slow, smooth horizontal camera slide to the right, parallel to the far wall.' },
  'walkthrough': { label: 'Walkthrough / transition', multi: true, text: 'One slow, continuous camera move through the same house that passes each photo in order and ends exactly on the last photo. Show only space that connects the photos.' },
};

const NEGATIVE = 'people, person, animals, pets, text, watermark, logo, new furniture, extra rooms, new windows, new doors, changed layout, warped walls, bent lines, morphing, flicker, blur, distortion, low quality';

function modelKey(middleCount) { return middleCount > 0 ? 'keyframes' : 'fast'; }
function cost(duration, middleCount = 0) { return MODELS[modelKey(middleCount)].cost[duration]; }

function cleanExtra(text) {
  const t = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > MAX_EXTRA) throw Error(`Extra direction is limited to ${MAX_EXTRA} characters.`);
  return t;
}

function validateClip({ move, duration, start, middles = [], end, extra }) {
  const m = MOVES[move];
  if (!m) throw Error('Pick a camera move.');
  if (![5, 10].includes(duration)) throw Error('Clip length must be 5 or 10 seconds.');
  if (middles.length > MAX_MIDDLES) throw Error(`At most ${MAX_MIDDLES} middle photos.`);
  const all = [[start, 'Start photo'], ...middles.map((x, i) => [x, `Middle photo ${i + 1}`]), [end, 'End photo']];
  for (const [img, label] of all) {
    if (!img) continue;
    if (!MIMES.has(img.mime)) throw Error(`${label}: only JPEG, PNG or WebP.`);
    if (img.bytes > MAX_IMAGE_BYTES) throw Error(`${label} is over 3 MB — the page shrinks photos first, so try again.`);
  }
  if (!start) throw Error('Add the start photo.');
  if (m.multi && !end) throw Error('A walkthrough needs the end photo too.');
  if (!m.multi && (end || middles.length)) throw Error('Only a walkthrough uses middle and end photos — remove them or pick Walkthrough.');
  cleanExtra(extra);
  return m;
}

function buildPrompt(move, extra) {
  const e = cleanExtra(extra);
  return [MOVES[move].text, e ? `Extra direction: ${e.replace(/[.!]*$/, '')}.` : '', KEEP].filter(Boolean).join(' ');
}

function buildInput({ move, duration, extra, startUrl, middleUrls = [], endUrl }) {
  const prompt = buildPrompt(move, extra);
  if (modelKey(middleUrls.length) === 'keyframes') {
    return { prompt, start_image_url: startUrl, middle_image_urls: middleUrls, end_image_url: endUrl, duration, resolution: '1080p' };
  }
  const input = { prompt, image_url: startUrl, duration: String(duration), negative_prompt: NEGATIVE, cfg_scale: 0.5 };
  if (MOVES[move].multi) input.tail_image_url = endUrl;
  return input;
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusUrl = id => `https://queue.fal.run/${QUEUE_APP}/requests/${id}/status`;
const resultUrl = id => `https://queue.fal.run/${QUEUE_APP}/requests/${id}`;

function listMoves() { return Object.entries(MOVES).map(([id, m]) => ({ id, label: m.label, multi: m.multi })); }
function costTable() { return { fast: MODELS.fast.cost, keyframes: MODELS.keyframes.cost }; }

module.exports = { MODELS, MOVES, NEGATIVE, MAX_IMAGE_BYTES, MAX_MIDDLES, MAX_EXTRA, REQUEST_ID, modelKey, cost, costTable, validateClip, buildPrompt, buildInput, statusUrl, resultUrl, listMoves };
