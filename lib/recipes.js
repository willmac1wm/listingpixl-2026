// Recipe Pack logic for the /staff Recipe Studio.
//
// Pure functions only — no I/O, no secrets, no network. The data comes from
// data/recipes.json (v1.1, copied from the Recipe Pack; edit the JSON and
// RECIPE-PACK.md together). The API route in api/staff-recipes.js does the
// OpenAI call; this file decides what is allowed and what the prompt is.
//
// Rules baked in from the 2026-11-06 tests:
// - Recipe 1 v1.1: lawn is the hero, thin foundation bed, max 5 plantings.
// - Recipe 2: anchor #42 furniture set, table long axis toward the sliding
//   door, living group square to the walls, rug in the foreground on
//   living-end angles.
// - Recipe 3: second pass ONLY on an approved landscaped image, dusk not
//   night. Never on a dirt yard.
// - gpt-image-1 was shut down 2026-10-23. Never use it.
const RECIPES = require('../data/recipes.json');

const MAX_IMAGES_PER_BATCH = 4; // up to 3 angles per batch, plus the prompt (no anchor image — see validateBatch)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RETIRED_MODEL = 'gpt-image-1';
const DEFAULT_MODEL = 'gpt-image-1.5';
const EDIT_SUFFIX = {
  'vl-lush-lawn-autumn': '-Virtually-Landscaped',
  'vs-modern-farmhouse-kitchen': '-Virtually-Staged',
  'vt-virtual-twilight': '-Virtually-Landscaped-Twilight',
};

const CATEGORIES = ['interior', 'exterior'];
const BUTTON_IMAGE_RE = /^\/images\/recipes\/[a-z0-9-]+\.jpg$/;

// A button image is only ever a real test photo copied into the repo
// (images/recipes/). Anything else is treated as missing, never rendered.
function buttonImageFor(recipe) {
  return BUTTON_IMAGE_RE.test(recipe.button_image || '') ? recipe.button_image : null;
}

function listRecipes() {
  return RECIPES.recipes.map(r => ({
    id: r.id, name: r.name, category: r.category, button_image: buttonImageFor(r),
    use_when: r.use_when, anchor: r.anchor,
    target_angles: r.target_angles, price_anchor: r.price_anchor,
    qc_checklist: r.qc_checklist, disclosure: r.disclosure,
    output_naming: r.output_naming,
  }));
}

// Live recipes for one step of the picker. Planned styles are NOT recipes
// and are never returned here, so they can never be selected or run.
function recipesByCategory(category) {
  if (!CATEGORIES.includes(category)) throw Error('Pick Interior or Exterior first.');
  return listRecipes().filter(r => r.category === category);
}

// Planned styles: names only, no prompt, no materials, no photo, no
// recipe behind them. They render as disabled "coming soon" cards.
function listPlannedStyles() {
  return (RECIPES.planned_styles || []).filter(s => s.status === 'planned').map(s => ({
    name: s.name, category: s.category, status: 'planned',
  }));
}

function plannedStylesByCategory(category) {
  if (!CATEGORIES.includes(category)) throw Error('Pick Interior or Exterior first.');
  return listPlannedStyles().filter(s => s.category === category);
}

function getRecipe(id) {
  return RECIPES.recipes.find(r => r.id === id) || null;
}

// The prompt is the recipe's prompt, verbatim. Never rewritten per batch —
// that is what made one-off edits drift.
function buildPrompt(recipe) { return recipe.prompt_chatgpt; }

// --- Staff-edited prompt overrides ---------------------------------------
// William can edit a recipe's prompt in the /staff Recipe Studio. An edit
// is stored as a staff-only override in private Blob (never in the repo,
// never in a public file) and the batch run uses it when one exists; the
// pack default in data/recipes.json is untouched. Only live recipes have
// an editable prompt — planned styles have no prompt yet, so they have
// nothing to edit.
const PROMPT_OVERRIDE_DIR = 'staff/recipe-prompts';
const MAX_PROMPT_CHARS = 8000;

function promptOverridePath(recipeId) {
  if (!/^[a-z0-9-]+$/.test(recipeId || '')) throw Error('Bad recipe id.');
  return `${PROMPT_OVERRIDE_DIR}/${recipeId}.json`;
}

function validatePromptText(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Error('The prompt cannot be empty.');
  if (prompt.length > MAX_PROMPT_CHARS) throw Error(`The prompt is too long — at most ${MAX_PROMPT_CHARS} characters.`);
  return prompt;
}

// Which prompt a batch actually runs: the staff override when one exists,
// the pack default otherwise. Returns the prompt plus where it came from,
// so the UI can say so plainly on the card.
function effectivePrompt(recipe, override) {
  if (override && typeof override.prompt === 'string' && override.prompt.trim()) {
    return { prompt: override.prompt, source: 'override', updatedAt: override.updatedAt || null };
  }
  return { prompt: recipe.prompt_chatgpt, source: 'pack', updatedAt: null };
}

function isEditableRecipe(recipeId) { return getRecipe(recipeId) !== null; }

// Everything the "Recipe prompts" section needs for one card: the prompt
// that will actually run, where it came from, and the KEEP / CHANGE ONLY /
// DO NOT lists it was built from, as read-only reference.
function promptDetails(recipe, override) {
  const eff = effectivePrompt(recipe, override);
  return {
    id: recipe.id, name: recipe.name, category: recipe.category,
    button_image: buttonImageFor(recipe), price_anchor: recipe.price_anchor,
    prompt: eff.prompt, source: eff.source, updatedAt: eff.updatedAt,
    packPrompt: recipe.prompt_chatgpt,
    keep: recipe.keep || [], change_only: recipe.change_only || [], do_not: recipe.do_not || [],
  };
}

function modelFor(recipe, override) {
  // recipe.settings.model is prose ("Current GPT Image model …"), not a
  // model name — never read it as one. Env override, else the default.
  const model = String(override || process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL).trim();
  if (model === RETIRED_MODEL) throw Error(`Model ${RETIRED_MODEL} was shut down 2026-10-23. Use ${DEFAULT_MODEL} or a newer GPT Image model.`);
  if (!/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(model)) throw Error('Bad image model name.');
  return model;
}

// Validate a batch before anything is sent to OpenAI. images are the
// angles ONLY — the photos that need fixing. There is no anchor from the
// user and no pre-built anchor: angle 1 is edited with the recipe prompt
// only, and its finished result becomes the reference the rest are
// matched to (see chainedPrompt). options:
// { landscapedApproved: boolean } — required for twilight.
function validateBatch(recipeId, images, options = {}) {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw Error('Unknown recipe.');
  if (!Array.isArray(images) || images.length < 1) throw Error('A batch needs at least one angle of the same space.');
  if (images.length > MAX_IMAGES_PER_BATCH - 1) throw Error(`A batch is at most ${MAX_IMAGES_PER_BATCH - 1} angles of the same space.`);
  for (const img of images) {
    if (!/^image\/(jpeg|png|webp)$/.test(img.mime || '')) throw Error(`Only JPEG, PNG or WebP images. Got: ${img.name || 'unnamed'}.`);
    if (!Number.isSafeInteger(img.bytes) || img.bytes <= 0 || img.bytes > MAX_IMAGE_BYTES) throw Error(`${img.name || 'Image'} is over the 5 MB per-image limit.`);
  }
  if (recipeId === 'vt-virtual-twilight') {
    // Twilight is a second pass on approved landscaped photos, never on a
    // dirt yard. Both the checkbox and the filenames must agree: every
    // angle in the batch must be a Virtually-Landscaped file.
    if (!options.landscapedApproved) throw Error('Twilight runs only on approved Virtually-Landscaped photos. Landscape first, twilight second.');
    for (const img of images) {
      if (!/-Virtually-Landscaped\.(jpe?g|png|webp)$/i.test(img.name || '')) throw Error('Every twilight angle must be a Virtually-Landscaped file (name ends -Virtually-Landscaped).');
    }
  }
  return recipe;
}

// Edited files never overwrite originals. Suffix by recipe, base name kept.
function editedFilename(originalName, recipeId) {
  const suffix = EDIT_SUFFIX[recipeId] || '-Virtually-Edited';
  const m = /^(.*?)(\.[a-z0-9]+)$/i.exec(originalName || 'photo.jpg');
  // Strip any earlier edit suffix first, so twilight on a landscaped file
  // becomes …-Virtually-Landscaped-Twilight, not …-Virtually-Landscaped-
  // Virtually-Landscaped-Twilight. Idempotent for the same recipe.
  const base = (m ? m[1] : 'photo').replace(/-(?:Virtually-Landscaped-Twilight|Virtually-Landscaped|Virtually-Staged)$/i, '');
  return base + suffix + (m ? m[2].toLowerCase() : '.jpg');
}

// Multipart body for POST /v1/images/edits. One image per call for the
// first angle; two for the rest (finished angle 1 first, raw angle
// second) — see chainedPrompt below.
function buildEditFormData({ model, prompt, images }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('quality', 'high');
  form.append('size', 'auto');
  images.forEach((img, i) => {
    form.append(`image[${i}]`, new Blob([img.buffer], { type: img.mime }), img.name);
  });
  return form;
}

// Chain anchor: angle 1 is edited with the recipe prompt only, and its
// finished result becomes the reference for the rest of the batch. The
// chained calls send TWO images — the finished angle 1 first, the raw
// angle second — with this prefix in front of the recipe prompt. The
// prefix is one sentence on purpose: it says what image 1 is and what to
// do with it, then the recipe prompt follows verbatim. "Match it exactly"
// is generic on purpose — lawn for the yard recipes, furniture for the
// interior ones — so one prefix serves every recipe.
const CHAIN_PREFIX = 'Image 1 is the finished look from this same space — match it exactly. ';
function chainedPrompt(prompt) { return CHAIN_PREFIX + prompt; }

// MLS-ready spec from the Recipe Pack delivery checklist.
const MLS_SPEC = { longEdgePx: 2048, format: 'JPEG', quality: '80–90%', maxBytes: 2 * 1024 * 1024, colorspace: 'sRGB' };
function mlsCheck({ width, height, bytes }) {
  const longEdge = Math.max(width || 0, height || 0);
  return {
    longEdgePx: longEdge, under2MB: bytes <= MLS_SPEC.maxBytes,
    ok: longEdge === MLS_SPEC.longEdgePx && bytes <= MLS_SPEC.maxBytes,
    spec: MLS_SPEC,
  };
}

module.exports = {
  RECIPES, listRecipes, getRecipe, recipesByCategory, listPlannedStyles,
  plannedStylesByCategory, buttonImageFor, CATEGORIES,
  buildPrompt, modelFor, validateBatch, chainedPrompt, CHAIN_PREFIX,
  editedFilename, buildEditFormData, mlsCheck, MLS_SPEC,
  MAX_IMAGES_PER_BATCH, MAX_IMAGE_BYTES, DEFAULT_MODEL,
  PROMPT_OVERRIDE_DIR, MAX_PROMPT_CHARS,
  promptOverridePath, validatePromptText, effectivePrompt,
  isEditableRecipe, promptDetails,
};
