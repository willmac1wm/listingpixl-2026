const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(require('node:path').join(__dirname, '..', 'styles.css'), 'utf8');
const js = fs.readFileSync(require('node:path').join(__dirname, '..', 'site.js'), 'utf8');

test('contact form stays intact alongside the chat widget', () => {
  assert.match(index, /<form id="contact-form" novalidate>/);
  assert.match(index, /<section id="contact"/);
  assert.match(index, /<div class="chat-widget" id="chat-widget">/);
  assert.match(index, /<div class="chat-log" id="chat-log" aria-live="polite">/);
  assert.match(index, /<form class="chat-form" id="chat-form">/);
  // Widget sits inside the Contact section, after the form.
  assert.ok(index.indexOf('chat-widget') > index.indexOf('contact-form'));
  assert.ok(index.indexOf('chat-widget') < index.indexOf('</section>', index.indexOf('chat-widget')));
});

test('chat widget posts to the bot web-chat contract', () => {
  assert.match(js, /https:\/\/bot\.listingpixl\.com\/web-chat/);
  assert.match(js, /session_id/);
  assert.match(js, /sessionStorage/);
  assert.match(js, /randomUUID/);
  // Greeting fetch on load uses an empty message.
  assert.match(js, /askChat\(''\)/);
  // A null reply shows no new bot message.
  assert.match(js, /if \(data && data\.reply\)/);
});

test('chat widget fails gracefully without a raw error', () => {
  assert.match(js, /Chat isn't online yet/);
  assert.match(js, /ListingPixl\.Media@gmail\.com/);
  assert.match(js, /\(609\) 780-7027/);
  assert.doesNotMatch(js, /stack|console\.error/);
});

test('chat widget styles use the brand palette, no orange', () => {
  assert.match(css, /\.chat-widget/);
  assert.match(css, /\.chat-msg\.bot/);
  assert.match(css, /\.chat-msg\.user/);
  assert.match(css, /\.chat-form/);
  assert.match(css, /--accent-pink/);
  const widgetCss = css.slice(css.indexOf('.chat-widget'));
  assert.doesNotMatch(widgetCss, /orange|#f97316|#ff6600/i);
});

test('no prices are hard-coded into the widget', () => {
  const widgetHtml = index.slice(index.indexOf('chat-widget'), index.indexOf('</section>', index.indexOf('chat-widget')));
  assert.doesNotMatch(widgetHtml, /\$\d+/);
  assert.doesNotMatch(widgetHtml, /250/);
});
