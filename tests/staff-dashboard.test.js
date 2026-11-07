// Readability redesign (Nov 2026): every section on /staff outside the Recipe
// Studio is a full-width tinted panel with a band header and a big bold title,
// instructions are short numbered steps, and long draft bodies sit in their
// own cards with a Hide/Show toggle. Behaviour is unchanged: drafts stay
// drafts-only and nothing on the page sends anything.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const shoots = require('../api/_shoots_ui');
const delivery = require('../api/_delivery_ui');
const guides = require('../api/_guides_ui');

test('shoots panel: blue panel, big heading, 3-step intro, Write the posts kept', () => {
  assert.match(shoots.html, /dash-panel dash-panel-blue/);
  assert.match(shoots.html, /<h2>New shoots<\/h2>/);
  assert.match(shoots.html, /nothing publishes until you approve/);
  assert.match(shoots.html, /Write the posts/);
  assert.match(shoots.html, /Pick a shoot\./);
  assert.match(shoots.script, /Draft — not published/);
  assert.match(shoots.script, /sh-toggle/);
  assert.match(shoots.script, /sh-approve/);
  // No wall of text: the Google hand-post instructions are numbered steps.
  assert.match(shoots.script, /On the profile: Add update\./);
});

test('delivery panel: pink panel, drafts-only warning, one card per draft text', () => {
  assert.match(delivery.html, /dash-panel dash-panel-pink/);
  assert.match(delivery.html, /<h2>Delivery<\/h2>/);
  assert.match(delivery.html, /Drafts only\./);
  assert.match(delivery.script, /dv-draft-card/);
  assert.match(delivery.script, /dv-sub/);
  assert.match(delivery.script, /What to send — drafts only, nothing sends from here/);
  for (const label of ['Delivery text', 'Email subject', 'Delivery email', 'Follow-up (2 days)', 'Review ask']) {
    assert.ok(delivery.script.includes(label), `missing draft label: ${label}`);
  }
});

test('delivery panel has no send path', () => {
  assert.doesNotMatch(delivery.script, /action\s*=\s*['"]send['"]/i);
  assert.doesNotMatch(delivery.script, /sendShoot|sendEmail|sendText/i);
  assert.doesNotMatch(delivery.html, />\s*Send\s*</);
});

test('learning center on the dashboard: shared panel system, numbered how-to steps, link sections kept', () => {
  // The panel system lives in the shared shell CSS; the guides page
  // renders one tinted panel per section from its tints.
  const shellSrc = fs.readFileSync(path.join(__dirname, '..', 'api', '_staff_shell.js'), 'utf8');
  for (const cls of ['dash-panel-teal', 'dash-panel-blue', 'dash-panel-pink', 'dash-panel-grey', 'dash-panel-head']) {
    assert.ok(shellSrc.includes(cls), `missing panel class in shell: ${cls}`);
  }
  assert.ok(guides.html.includes('dash-panel dash-panel-teal'), 'missing teal panel');
  assert.ok(guides.html.includes('dash-panel dash-panel-blue'), 'missing blue panel');
  assert.ok(guides.html.includes('dash-panel dash-panel-grey'), 'missing grey panel');
  assert.ok(guides.html.includes('dash-panel-head'), 'missing panel header');
  for (const title of ['Run the business', 'Get found online', 'Website', 'How to update the website', 'Not set up yet']) {
    assert.ok(guides.html.includes(title), `missing section: ${title}`);
  }
  assert.match(guides.html, /dash-steps/);
  assert.match(guides.html, /Start in the right place/);
  // How-to bodies are one idea per line, not a single long paragraph.
  assert.match(guides.html, /About 5 minutes later the draft blog post and social posts appear there\./);
  // The how-to points at the Posts page now that New shoots lives there.
  assert.match(guides.html, /Pick the shoot on the Posts page\./);
  assert.doesNotMatch(guides.html, /at the top of this page/);
});
