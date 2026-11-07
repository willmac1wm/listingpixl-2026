// Shared shell for every /staff page (Nov 2026): the dashboard is split
// into one page per job — Dashboard, Sites, Photo Editing, Posts, Clients,
// CRM, Business, Account — like HD Photo Hub, instead of one long scroll.
// The shell follows HD's pattern: white header with the logo top-left and
// the top nav top-right (current page underlined), a narrow left sidebar
// on inner pages, and no sidebar on the Dashboard. The only addition to
// HD's map is Photo Editing (the Recipe Studio), in the middle of the
// workflow: shoot -> edit -> deliver. Support is an external link to HD
// Photo Hub support (support@hdphotohub.com — the address HD itself
// publishes); there is no support page here.
//
// Every page gets the same panel design system as the Recipe Studio
// redesign (teal / blue / pink / grey tints, band headers, big bold
// titles). The page modules themselves (api/_recipes_ui.js,
// api/_shoots_ui.js, api/_delivery_ui.js, api/_sites_ui.js and friends)
// only supply their own section; this file supplies everything around it.
//
// Footer links are HD's own, verified Nov 6 from listingpixl.hd.pics
// and hdphotohub.com: System Status, Privacy Policy, Terms of Use,
// Disclaimer, Cookie Policy.
const { requireStaff } = require('./_auth');

// [label, href, external?] — Support is a mail link to HD's published
// support address, not a page on this site.
const NAV = [
  ['Dashboard', '/staff'],
  ['Sites', '/staff/sites'],
  ['Photo Editing', '/staff/studio'],
  ['Posts', '/staff/posts'],
  ['Clients', '/staff/clients'],
  ['CRM', '/staff/crm'],
  ['Business', '/staff/business'],
  ['Account', '/staff/account'],
  ['Support', 'mailto:support@hdphotohub.com', true],
];

const FOOTER_LINKS = [
  ['System Status', 'https://status.hdphotohub.com'],
  ['Privacy Policy', 'https://listingpixl.hd.pics/public/privacy.asp'],
  ['Terms of Use', 'https://listingpixl.hd.pics/public/terms.asp'],
  ['Disclaimer', 'https://listingpixl.hd.pics/public/disclaimer.asp'],
  ['Cookie Policy', 'https://listingpixl.hd.pics/public/cookies.asp'],
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nav(active) {
  return `<nav class="dash-nav" aria-label="Team dashboard pages">${NAV.map(([label, href, external]) => `
      <a href="${esc(href)}"${label === active ? ' class="dash-nav-active" aria-current="page"' : ''}${external ? ' target="_blank" rel="noopener noreferrer" title="Email HD Photo Hub support"' : ''}>${label}</a>`).join('')}
      <a href="/staff/logout">Sign out</a>
    </nav>`;
}

function sidebar(items) {
  if (!items || !items.length) return '';
  return `<aside class="dash-side"><nav aria-label="This section">${items.map(([label, href, external]) => `
      <a href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a>`).join('')}
    </nav></aside>`;
}

function staffPage({ title, heading, active, sidebar: side, css = [], body = '', scripts = [] }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)} | Listing Pixl</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .dash-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; background: #fff; border-bottom: 1px solid var(--card-border, #e5e0d5); padding: 0.6rem 1.5rem; }
    .dash-top img { height: 40px; width: auto; display: block; }
    /* Top nav, HD pattern: plain links, the page you are on is underlined. */
    .dash-nav { display: flex; flex-wrap: wrap; gap: 0.25rem 1.1rem; align-items: center; }
    .dash-nav a { font: inherit; font-weight: 600; text-decoration: none; color: var(--ink, #1d1d1d); padding: 0.35rem 0.1rem; border-bottom: 3px solid transparent; }
    .dash-nav a:hover, .dash-nav a:focus-visible { border-bottom-color: var(--accent-pink, #d63384); }
    .dash-nav a.dash-nav-active { font-weight: 800; border-bottom-color: #14262b; }
    .dash-wrap { display: flex; gap: 1.5rem; max-width: 1180px; margin: 0 auto; padding: 1.5rem 16px 2rem; align-items: flex-start; }
    .dash-wrap--wide { max-width: 1080px; display: block; }
    .dash-side { flex: none; width: 200px; position: sticky; top: 1rem; }
    .dash-side nav { display: flex; flex-direction: column; gap: 0.1rem; background: #fff; border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; padding: 0.5rem; }
    .dash-side a { font: inherit; font-weight: 600; text-decoration: none; color: var(--ink, #1d1d1d); padding: 0.5rem 0.75rem; border-radius: 8px; }
    .dash-side a:hover, .dash-side a:focus-visible { background: #f0f9fa; }
    .dash-main { flex: 1; min-width: 0; }
    .dash-title { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.01em; text-align: left; }
    .dash-sub { margin: 0 0 1.25rem; font-size: 1rem; color: var(--muted, #4f5b5e); }
    /* Shared panel system — same treatment as the Recipe Studio steps, so
       every section on every page is tell-apart at a glance: its own tint,
       its own band header, and a big bold title. No two panels next to
       each other share a tint. */
    .dash-panel { border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 16px; background: var(--dash-tint, #fff); overflow: hidden; margin: 0 0 1rem; }
    .dash-panel-head { padding: 0.9rem 1.5rem; background: var(--dash-band, #e9eeef); border-bottom: 1px solid var(--dash-edge, #cfd6d7); }
    .dash-panel-head h2 { margin: 0; font-size: 1.4rem; font-weight: 800; line-height: 1.2; text-align: left; }
    .dash-panel-sub { margin: 0.15rem 0 0; font-size: 0.95rem; color: var(--muted, #4f5b5e); }
    .dash-panel-body { padding: 1rem 1.5rem 1.25rem; }
    .dash-panel-teal { --dash-tone: #0c7a8c; --dash-tint: #f0f9fa; --dash-band: #d5eef1; --dash-edge: #9fd3da; }
    .dash-panel-blue { --dash-tone: #0060cc; --dash-tint: #f0f6ff; --dash-band: #d6e7ff; --dash-edge: #a3caff; }
    .dash-panel-pink { --dash-tone: #d71266; --dash-tint: #fff2f7; --dash-band: #fcd9e7; --dash-edge: #f4a9c8; }
    .dash-panel-grey { --dash-tone: #14262b; --dash-tint: #f5f5f3; --dash-band: #e2e3df; --dash-edge: #bfc3bd; }
    .dash-section { margin: 2rem 0; }
    .dash-section h2 { font-size: 1.15rem; margin: 0 0 0.75rem; text-align: left; }
    .dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
    .dash-card { display: flex; flex-direction: column; gap: 0.3rem; padding: 1rem 1.1rem; border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); color: var(--ink, #1d1d1d); text-decoration: none; transition: border-color 0.15s ease, transform 0.15s ease; }
    .dash-card:hover, .dash-card:focus-visible { border-color: var(--accent-pink, #d63384); transform: translateY(-1px); }
    .dash-card strong { font-size: 1rem; }
    .dash-card span { font-size: 0.88rem; color: var(--muted, #666); }
    /* Numbered how-to steps: one idea per line, no wall of text. */
    .dash-steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
    .dash-steps li { display: flex; gap: 0.75rem; background: #fff; border: 1px solid var(--dash-edge, #cfd6d7); border-radius: 12px; padding: 0.85rem 1rem; }
    .dash-step-num { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; background: var(--dash-tone, #0c7a8c); color: #fff; font-size: 0.95rem; font-weight: 800; }
    .dash-steps strong { font-size: 1.05rem; }
    .dash-steps p { margin: 0.2rem 0 0; font-size: 0.95rem; color: var(--muted, #4f5b5e); }
    .dash-list { padding-left: 1.2rem; color: var(--muted, #555); }
    .dash-list li { margin: 0.5rem 0; }
    .dash-list strong { color: var(--ink, #1d1d1d); }
    .dash-todo { display: flex; flex-wrap: wrap; gap: 0.45rem; list-style: none; padding: 0; }
    .dash-todo li { border: 1px dashed var(--card-border, #ccc); border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.88rem; color: var(--muted, #666); background: #fff; }
    .dash-foot { margin-top: 2rem; padding: 1.25rem 1.5rem 2.5rem; background: #efefed; border-top: 1px solid var(--card-border, #e5e0d5); font-size: 0.85rem; color: var(--muted, #666); }
    .dash-foot nav { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; max-width: 1180px; margin: 0 auto 0.5rem; }
    .dash-foot a { color: var(--muted, #666); }
    .dash-foot p { max-width: 1180px; margin: 0 auto; }
${css.join('\n')}
  </style>
</head>
<body>
  <header class="dash-top">
    <a href="/staff" aria-label="Listing Pixl team dashboard"><img src="/images/logo-horizontal-312.jpg" alt="Listing Pixl" width="156" height="66"></a>
    ${nav(active)}
  </header>
  <div class="dash-wrap${side && side.length ? '' : ' dash-wrap--wide'}">
    ${sidebar(side)}
    <main class="dash-main">
      <h1 class="dash-title">${esc(heading || title)}</h1>
      ${body}
    </main>
  </div>
  <footer class="dash-foot">
    <nav aria-label="HD Photo Hub legal pages">${FOOTER_LINKS.map(([label, href]) => `
      <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}
    </nav>
    <p>Links open in a new tab. Each service still asks for its own login. Team sessions expire after four hours.</p>
  </footer>
  <script>${scripts.join('\n')}</script>
</body>
</html>`;
}

// Shared handler wrapper for the staff pages: same 503 when the team
// password is not set, same sign-in redirect, same no-store headers as
// /staff itself. `next` is the page's own URL, so signing in from a
// bookmarked subpage brings you back to that page.
async function serveStaffPage(req, res, next, pageOpts) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!process.env.STAFF_PASSWORD) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('The team dashboard is not set up yet: add STAFF_PASSWORD in Vercel > Settings > Environment Variables, then redeploy.');
  }
  if (!await requireStaff(req, res, next)) return;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(staffPage(pageOpts));
}

module.exports = { NAV, FOOTER_LINKS, staffPage, serveStaffPage };
