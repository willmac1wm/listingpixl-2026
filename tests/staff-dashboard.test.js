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
const staffSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'staff.js'), 'utf8');

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

test('dashboard shell: shared panel system, numbered how-to steps, link sections kept', () => {
  for (const cls of ['dash-panel-teal', 'dash-panel-blue', 'dash-panel-pink', 'dash-panel-grey', 'dash-panel-head']) {
    assert.ok(staffSrc.includes(cls), `missing panel class: ${cls}`);
  }
  for (const title of ['Run the business', 'Get found online', 'Website', 'How to update the website', 'Not set up yet']) {
    assert.ok(staffSrc.includes(title), `missing section: ${title}`);
  }
  assert.match(staffSrc, /dash-steps/);
  assert.match(staffSrc, /Start in the right place/);
  // How-to bodies are one idea per line, not a single long paragraph.
  assert.match(staffSrc, /About 5 minutes later the draft blog post and social posts appear there\./);
});
