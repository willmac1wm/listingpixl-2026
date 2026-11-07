// Pages split (Nov 2026): the /staff dashboard is one page per job —
// Dashboard, Sites, Photo Editing, Posts, Clients, CRM, Business,
// Account — matching HD Photo Hub, instead of one long scroll. The only
// addition to HD's map is Photo Editing (the Recipe Studio), in the
// middle of the workflow: shoot -> edit -> deliver. Each page serves
// only its own section, every page shares the same navigation, and
// behaviour is unchanged: drafts stay drafts-only and nothing on any
// page sends anything.
//
// Deliberately NOT built: a Groups page (empty in HD for William, no
// group data here), a standalone Photos page (HD has none — photos live
// in the Sites cards and the CRM's Approved files + MLS-ready export),
// and the other 19 HD Business sidebar items (no data or function
// behind them here).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NAV, FOOTER_LINKS, staffPage } = require('../api/_staff_shell');
const home = require('../api/staff');
const sites = require('../api/staff-sites');
const studio = require('../api/staff-studio');
const posts = require('../api/staff-posts');
const clients = require('../api/staff-clients');
const crm = require('../api/staff-crm');
const business = require('../api/staff-business');
const account = require('../api/staff-account');
const { mergeClients } = require('../api/_clients_ui');

const PAGES = [
  ['Dashboard', '/staff', home],
  ['Sites', '/staff/sites', sites],
  ['Photo Editing', '/staff/studio', studio],
  ['Posts', '/staff/posts', posts],
  ['Clients', '/staff/clients', clients],
  ['CRM', '/staff/crm', crm],
  ['Business', '/staff/business', business],
  ['Account', '/staff/account', account],
];

test('shared navigation lists every staff page, exactly once each, HD order', () => {
  assert.deepEqual(NAV, [
    ['Dashboard', '/staff'],
    ['Sites', '/staff/sites'],
    ['Photo Editing', '/staff/studio'],
    ['Posts', '/staff/posts'],
    ['Clients', '/staff/clients'],
    ['CRM', '/staff/crm'],
    ['Business', '/staff/business'],
    ['Account', '/staff/account'],
    ['Support', 'mailto:support@hdphotohub.com', true],
  ]);
  // No Photos page, no Guides page, no Groups page — HD has no standalone
  // Photos page, Groups is empty for William, and guides live on the
  // Dashboard as the Learning Center.
  for (const [label] of NAV) assert.doesNotMatch(label, /^(Photos|Guides|Groups)$/);
  for (const [, , mod] of PAGES) {
    const html = mod.page();
    for (const [label, href] of NAV) {
      assert.ok(html.includes(`href="${href}"`), `${label} link missing`);
      assert.ok(html.includes(`>${label}</a>`), `${label} label missing`);
    }
  }
});

test('navigation marks only the current page', () => {
  for (const [label, href, mod] of PAGES) {
    const html = mod.page();
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1, `${label} page should mark exactly one nav item`);
    assert.ok(html.includes(`href="${href}" class="dash-nav-active" aria-current="page"`), `${label} page should mark itself`);
  }
  // The shell on its own does the same for any active page.
  const shellHtml = staffPage({ title: 'Test', active: 'Sites', css: [], body: '', scripts: [] });
  assert.ok(shellHtml.includes('href="/staff/sites" class="dash-nav-active" aria-current="page"'));
  assert.equal((shellHtml.match(/aria-current="page"/g) || []).length, 1);
});

test('support is an external link to HD Photo Hub support, not a page', () => {
  const html = home.page();
  assert.match(html, /href="mailto:support@hdphotohub\.com"/);
  assert.match(html, /title="Email HD Photo Hub support"/);
});

test('footer links to HD Photo Hub legal pages, verified Nov 6', () => {
  assert.deepEqual(FOOTER_LINKS, [
    ['System Status', 'https://status.hdphotohub.com'],
    ['Privacy Policy', 'https://listingpixl.hd.pics/public/privacy.asp'],
    ['Terms of Use', 'https://listingpixl.hd.pics/public/terms.asp'],
    ['Disclaimer', 'https://listingpixl.hd.pics/public/disclaimer.asp'],
    ['Cookie Policy', 'https://listingpixl.hd.pics/public/cookies.asp'],
  ]);
  for (const [, , mod] of PAGES) {
    const html = mod.page();
    for (const [, href] of FOOTER_LINKS) assert.ok(html.includes(`href="${href}"`), `footer link missing: ${href}`);
  }
});

test('dashboard has no sidebar, inner pages do', () => {
  // The shell CSS always defines .dash-side; check for the rendered element.
  assert.doesNotMatch(home.page(), /<aside class="dash-side">/);
  for (const [label, , mod] of PAGES.slice(1)) {
    assert.match(mod.page(), /<aside class="dash-side">/, `${label} page should have a sidebar`);
  }
});

test('dashboard is the HD-style home: welcome, live stats, Quick Start, needs lists, recent shoots, top clients, Learning Center', () => {
  const html = home.page();
  assert.match(html, /Welcome to your account, William/);
  assert.match(html, /At a glance/);
  for (const id of ['dash-stat-shoots', 'dash-stat-sites', 'dash-stat-batches', 'dash-stat-files', 'dash-stat-drafts', 'dash-stat-pending']) {
    assert.ok(html.includes(`id="${id}"`), `stat tile missing: ${id}`);
  }
  assert.match(html, /Quick Start/);
  for (const href of ['/staff/crm', '/staff/studio', '/staff/posts']) assert.ok(html.includes(`href="${href}"`), `Quick Start link missing: ${href}`);
  assert.match(html, /Needs to be Scheduled/);
  assert.match(html, /Needs to be Completed/);
  assert.match(html, /Recent shoots/);
  assert.match(html, /Top clients/);
  // Learning Center lives at the bottom of the Dashboard.
  assert.match(html, /How to update the website/);
  assert.match(html, /Run the business/);
  // Stats come from endpoints the sections already load — no new API.
  assert.match(html, /\/staff\/delivery\?action=shoots/);
  assert.match(html, /\/staff\/shoots\?action=sites/);
  assert.match(html, /\/staff\/shoots\?action=drafts/);
  assert.match(html, /\/staff\/recipes\?action=batches/);
  // Dashboard holds no section of its own.
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /<h2>New shoots<\/h2>/);
  assert.doesNotMatch(html, /id="delivery"/);
  assert.doesNotMatch(html, /<h2>Sites<\/h2>/);
  assert.doesNotMatch(html, /<h2>Clients<\/h2>/);
});

test('sites page holds HD-style site cards with search, sort and a link out to HD for creating a site', () => {
  const html = sites.page();
  assert.match(html, /<h2>Sites<\/h2>/);
  assert.match(html, /id="st-search"/);
  assert.match(html, /id="st-sort"/);
  assert.match(html, /Create a New Real Estate Site/);
  assert.match(html, /href="https:\/\/listingpixl\.hd\.pics\/Sites\/search\.asp"/);
  assert.match(html, /\/staff\/shoots\?action=sites/);
  // Cards show Site # and photo count; no status is invented — HD's
  // status field is not in the fields this API returns.
  assert.match(html, /Site #/);
  assert.doesNotMatch(html, /Preparing|Delivery Only|Live|Pending|Sold|Offline/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /<h2>New shoots<\/h2>/);
  assert.doesNotMatch(html, /id="delivery"/);
});

test('studio page holds the whole Recipe Studio and nothing else', () => {
  const html = studio.page();
  assert.match(html, /Recipe Studio — batch edits, one space at a time/);
  assert.match(html, /rc-studio/);
  assert.match(html, /Select Model/);
  assert.match(html, /Run batch/);
  assert.match(html, /Recent batches/);
  assert.match(html, /Recipe settings — advanced/);
  // Sidebar links to the Studio's own anchors.
  assert.match(html, /href="\/staff\/studio#rc-batches"/);
  assert.match(html, /href="\/staff\/studio#rc-settings-door"/);
  assert.doesNotMatch(html, /<h2>New shoots<\/h2>/);
  assert.doesNotMatch(html, /id="delivery"/);
  assert.doesNotMatch(html, /<h2>Sites<\/h2>/);
  assert.doesNotMatch(html, /How to update the website/);
});

test('posts page holds the New shoots drafts and nothing else', () => {
  const html = posts.page();
  assert.match(html, /<h2>New shoots<\/h2>/);
  assert.match(html, /Write the posts/);
  assert.match(html, /nothing publishes until you approve/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /id="delivery"/);
  assert.doesNotMatch(html, /<h2>Sites<\/h2>/);
  assert.doesNotMatch(html, /How to update the website/);
});

test('clients page holds a table from CRM shoots plus HD sites, with a link out to HD for creating a client', () => {
  const html = clients.page();
  assert.match(html, /<h2>Clients<\/h2>/);
  for (const col of ['Client Name', 'Phone', 'Brokerage', 'CRM shoots', 'HD sites']) assert.ok(html.includes(`<th>${col}</th>`), `column missing: ${col}`);
  assert.match(html, /Create a New Client/);
  assert.match(html, /href="https:\/\/listingpixl\.hd\.pics\/Clients\/search\.asp"/);
  assert.match(html, /\/staff\/delivery\?action=shoots/);
  assert.match(html, /\/staff\/shoots\?action=sites/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /id="delivery"/);
});

test('client merge counts CRM shoots and HD sites per agent, phone and brokerage only from the CRM', () => {
  const merged = mergeClients(
    [
      { agentName: 'Jason Ruffenach', agentPhone: '6095550001', brokerage: 'eXp Realty', status: 'shot' },
      { agentName: 'jason ruffenach', agentPhone: '', brokerage: '', status: 'ready' },
      { agentName: 'William Macomber', agentPhone: '6097807027', brokerage: '', status: 'delivered' },
      { agentName: '  ', agentPhone: '6095550002', brokerage: '', status: 'shot' },
    ],
    [
      { agent: 'Jason Ruffenach' },
      { agent: 'Jason Ruffenach' },
      { agent: 'Alexander M. Powers' },
      { agent: '' },
    ],
  );
  assert.deepEqual(merged, [
    { name: 'Alexander M. Powers', phone: '', brokerage: '', crmShoots: 0, hdSites: 1 },
    { name: 'Jason Ruffenach', phone: '6095550001', brokerage: 'eXp Realty', crmShoots: 2, hdSites: 2 },
    { name: 'William Macomber', phone: '6097807027', brokerage: '', crmShoots: 1, hdSites: 0 },
  ]);
  assert.deepEqual(mergeClients([], []), []);
});

test('crm page holds the whole delivery CRM and nothing else', () => {
  const html = crm.page();
  assert.match(html, /<h2>Delivery<\/h2>/);
  assert.match(html, /Drafts only\./);
  assert.match(html, /What to send/);
  assert.match(html, /Stripe Payment Link/);
  assert.match(html, /Tours & video/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /<h2>New shoots<\/h2>/);
  assert.doesNotMatch(html, /<h2>Sites<\/h2>/);
  assert.doesNotMatch(html, /How to update the website/);
});

test('business page holds the summary, real-data stats and team members — and none of HD\'s other 19 sidebar items', () => {
  const html = business.page();
  assert.match(html, /<h2>Business Summary<\/h2>/);
  assert.match(html, /Listing Pixl/);
  assert.match(html, /William Macomber/);
  assert.match(html, /listingpixl\.hd\.pics/);
  assert.match(html, /<h2>Stats<\/h2>/);
  assert.match(html, /<h2>Team Members<\/h2>/);
  for (const id of ['bs-stat-sites', 'bs-stat-shoots', 'bs-stat-clients', 'bs-stat-files', 'bs-stat-batches']) {
    assert.ok(html.includes(`id="${id}"`), `stat tile missing: ${id}`);
  }
  // No created date — it is not in our data, and no date is invented.
  assert.doesNotMatch(html, /Created On|11\/19\/2022/);
  for (const item of ['Default Settings', 'Bulk Activations', 'Shopping Cart', 'Sales Tax', 'Market Areas', 'Service Areas', 'Site Attribution', 'Custom Designs', 'Email Messages', 'Webhooks/API', 'Referral Code', 'Pay Team']) {
    assert.ok(!html.includes(item), `unbuilt Business item leaked in: ${item}`);
  }
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /id="delivery"/);
});

test('account page is read-only basic info, with no password or driver\'s-license management', () => {
  const html = account.page();
  assert.match(html, /<h2>My Account<\/h2>/);
  assert.match(html, /William Macomber/);
  assert.match(html, /6097807027/);
  assert.match(html, /ListingPixl\.Media@gmail\.com/);
  assert.match(html, /read-only/);
  assert.match(html, /href="https:\/\/listingpixl\.hd\.pics\/Account\/"/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(html, /Update Password/);
  assert.doesNotMatch(html, /rc-studio/);
  assert.doesNotMatch(html, /id="delivery"/);
});

test('vercel routes serve every staff page, and the old guessed routes are gone', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const routes = new Map(vercel.routes.map(r => [r.src, r.dest]));
  for (const [src, dest] of [
    ['/staff/?', '/api/staff'],
    ['/staff/sites/?', '/api/staff-sites'],
    ['/staff/studio/?', '/api/staff-studio'],
    ['/staff/posts/?', '/api/staff-posts'],
    ['/staff/clients/?', '/api/staff-clients'],
    ['/staff/crm/?', '/api/staff-crm'],
    ['/staff/business/?', '/api/staff-business'],
    ['/staff/account/?', '/api/staff-account'],
    ['/staff/shoots', '/api/shoots'],
    ['/staff/recipes', '/api/staff-recipes'],
    ['/staff/delivery', '/api/staff-delivery'],
  ]) assert.equal(routes.get(src), dest, `missing route: ${src} -> ${dest}`);
  for (const src of ['/staff/photos/?', '/staff/guides/?']) assert.equal(routes.get(src), undefined, `guessed route still present: ${src}`);
  const fns = vercel.functions || {};
  for (const name of ['api/staff-sites.js', 'api/staff-clients.js', 'api/staff-business.js', 'api/staff-account.js']) {
    assert.ok(fns[name], `missing function config: ${name}`);
  }
  for (const name of ['api/staff-photos.js', 'api/staff-guides.js']) assert.equal(fns[name], undefined, `guessed function config still present: ${name}`);
});

test('signed-out visitors to a staff page are sent to sign-in, back to that page', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  process.env.STAFF_PASSWORD = 'LOCAL-TEST-ONLY-not-an-account-password';
  const response = () => {
    const saved = new Map();
    return { statusCode: 200, body: '',
      setHeader(key, value) { saved.set(key.toLowerCase(), value); },
      getHeader(key) { return saved.get(key.toLowerCase()); },
      end(value = '') { this.body = value; },
    };
  };
  try {
    for (const [label, href, mod] of PAGES) {
      const res = response();
      await mod({ method: 'GET', url: href, headers: { host: 'www.listingpixl.com', accept: 'text/html' } }, res);
      assert.equal(res.statusCode, 303, `${label} should redirect to sign-in`);
      assert.equal(res.getHeader('location'), '/staff/login?next=' + encodeURIComponent(href), `${label} should return to its own page after sign-in`);
    }
  } finally {
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});

test('staff pages are locked until STAFF_PASSWORD is set', async () => {
  const oldPass = process.env.STAFF_PASSWORD;
  delete process.env.STAFF_PASSWORD;
  const response = () => {
    const saved = new Map();
    return { statusCode: 200, body: '',
      setHeader(key, value) { saved.set(key.toLowerCase(), value); },
      getHeader(key) { return saved.get(key.toLowerCase()); },
      end(value = '') { this.body = value; },
    };
  };
  try {
    for (const [, , mod] of PAGES) {
      const res = response();
      await mod({ method: 'GET', url: '/staff', headers: { host: 'www.listingpixl.com' } }, res);
      assert.equal(res.statusCode, 503);
      assert.match(res.body, /STAFF_PASSWORD/);
    }
  } finally {
    if (oldPass === undefined) delete process.env.STAFF_PASSWORD; else process.env.STAFF_PASSWORD = oldPass;
  }
});
