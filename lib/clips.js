// AI Clips: short camera-move video clips made from FINISHED listing photos.
//
// Provider: fal.ai, pay per clip, no subscription. Model: Kling 2.5 Turbo
// Pro image-to-video (chosen 2026-11-07: cheapest model that handles slow
// interior push-ins well and takes an end frame for room-to-room
// transitions). fal's own price page, read 2026-11-07: $0.35 for a 5 s
// clip, $0.07 for each extra second, so 10 s = $0.70.
//
// Rule for every clip: the camera moves, the house does not change. The
// prompt and negative prompt forbid new rooms, objects, people and text, so
// a clip never shows something the listing does not have. A transition
// only moves between two real photos of the same house.
const MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const QUEUE_APP = 'fal-ai/kling-video'; // status/result URLs use owner/app only
const COST = { 5: 0.35, 10: 0.70 };
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const KEEP = 'Keep the house exactly as it is in the photo: same walls, windows, doors, floors, ceilings, cabinets, furniture, fixtures, colours, light and view. Do not add, remove or change any object, room, wall or feature. No people, no animals, no text. Steady, level, slow, smooth real-estate camera move; straight vertical lines.';

const MOVES = {
  'push-in': { label: 'Push in', needsEnd: false, text: 'Slow, smooth dolly push-in straight toward the centre of the scene.' },
  'pull-out': { label: 'Pull out', needsEnd: false, text: 'Slow, smooth dolly pull-back away from the centre of the scene, revealing only what is already in the photo.' },
  'pan-left': { label: 'Pan left', needsEnd: false, text: 'Slow, smooth horizontal camera slide to the left, parallel to the far wall.' },
  'pan-right': { label: 'Pan right', needsEnd: false, text: 'Slow, smooth horizontal camera slide to the right, parallel to the far wall.' },
  'transition': { label: 'Transition to next photo', needsEnd: true, text: 'One slow, continuous camera move that travels from the first photo to the second photo of the same house, ending exactly on the second photo. Show only space that connects the two photos.' },
};

const NEGATIVE = 'people, person, animals, pets, text, watermark, logo, new furniture, extra rooms, new windows, new doors, changed layout, warped walls, bent lines, morphing, flicker, blur, distortion, low quality';

function cost(duration) { return COST[duration]; }

function validateClip({ move, duration, start, end }) {
  const m = MOVES[move];
  if (!m) throw Error('Pick a camera move.');
  if (!COST[duration]) throw Error('Clip length must be 5 or 10 seconds.');
  for (const [img, label] of [[start, 'Start photo'], [end, 'End photo']]) {
    if (!img) continue;
    if (!MIMES.has(img.mime)) throw Error(`${label}: only JPEG, PNG or WebP.`);
    if (img.bytes > MAX_IMAGE_BYTES) throw Error(`${label} is over 3 MB — the page shrinks photos first, so try again.`);
  }
  if (!start) throw Error('Add the start photo.');
  if (m.needsEnd && !end) throw Error('A transition needs the end photo too.');
  if (!m.needsEnd && end) throw Error('Only a transition uses an end photo — remove it or pick Transition.');
  return m;
}

function buildPrompt(move) { return `${MOVES[move].text} ${KEEP}`; }

function buildInput({ move, duration, startUrl, endUrl }) {
  const input = { prompt: buildPrompt(move), image_url: startUrl, duration: String(duration), negative_prompt: NEGATIVE, cfg_scale: 0.5 };
  if (MOVES[move].needsEnd) input.tail_image_url = endUrl;
  return input;
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusUrl = id => `https://queue.fal.run/${QUEUE_APP}/requests/${id}/status`;
const resultUrl = id => `https://queue.fal.run/${QUEUE_APP}/requests/${id}`;

function listMoves() { return Object.entries(MOVES).map(([id, m]) => ({ id, label: m.label, needsEnd: m.needsEnd })); }

module.exports = { MODEL, COST, MOVES, NEGATIVE, MAX_IMAGE_BYTES, REQUEST_ID, cost, validateClip, buildPrompt, buildInput, statusUrl, resultUrl, listMoves };
