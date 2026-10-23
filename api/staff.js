// Team dashboard at /staff: one page linking every service Listing Pixl runs on.
//
// The page is built here, not stored as a public file, so nobody sees it
// without the team password. Login is the browser's own username/password
// box (HTTP Basic auth over HTTPS).
//
// Needs one Vercel environment variable: STAFF_PASSWORD. STAFF_USER is
// optional (default "team"). Until STAFF_PASSWORD is set the page stays
// locked for everyone.
//
// To add a link, add a line to SECTIONS below and push.
const { authorized } = require('./_auth');
const shoots = require('./_shoots_ui');

const SECTIONS = [
  {
    title: 'Run the business',
    links: [
      ['Website inquiry inbox', '/staff/inquiries', 'Private saved copies, delivery status and recovery for website questions'],
      ['HD Photo Hub admin', 'https://listingpixl.hd.pics/admin', 'Orders, uploads, deliveries and client galleries'],
      ['Client site (HD Photo Hub)', 'https://listingpixl.hd.pics/Dashboard/', 'What agents see when they log in'],
      ['AI phone receptionist (Smith.ai)', 'https://app.smith.ai/', 'Call log, messages, greeting and call forwarding'],
      ['Business email', 'https://mail.google.com/', 'ListingPixl.Media@gmail.com, where website questions arrive'],
    ],
  },
  {
    title: 'Get found online',
    links: [
      ['Google Business Profile', 'https://business.google.com/locations', 'Posts, photos, hours, reviews and messages'],
      ['See our Google listing', 'https://www.google.com/maps/place/Listing+Pixl/data=!4m2!3m1!1s0x0:0x703f0633afc98454', 'How the profile looks to customers on Maps'],
      ['Facebook page', 'https://www.facebook.com/listing.pixl.media/', 'The public page'],
      ['Meta Business Suite', 'https://business.facebook.com/', 'Facebook and Instagram posts, reels, messages and ads'],
      ['Google Search Console', 'https://search.google.com/search-console', 'What people search to find the site; submit the sitemap'],
      ['Google Analytics', 'https://analytics.google.com/', 'Website visitors and contact-form leads'],
    ],
  },
  {
    title: 'Website',
    links: [
      ['Live website', 'https://www.listingpixl.com/', 'listingpixl.com'],
      ['Blog: every shoot', 'https://www.listingpixl.com/blog/', 'Property posts'],
      ['Hosting (Vercel)', 'https://vercel.com/willmac1wm-gmailcoms-projects/listingpixl-2026', 'Deploys, previews and settings such as this page\'s password'],
      ['Website files (GitHub)', 'https://github.com/willmac1wm/listingpixl-2026', 'Every page, photo and change'],
      ['Domain (Namecheap)', 'https://ap.www.namecheap.com/domains/list/', 'listingpixl.com renewal and DNS'],
    ],
  },
];

const HOW_TO = [
  ['Start in the right place', 'In Claude Code, start a new session in the listingpixl-2026 folder (Documents > GitHub > listingpixl-2026). Any session there knows how the site works, because the instructions are saved in the project on GitHub. If that folder is ever missing, start a session anywhere and ask it to clone github.com/willmac1wm/listingpixl-2026 into Documents/GitHub.'],
  ['New shoot on the blog, Google, Facebook and Instagram', 'Pick the shoot under New shoots at the top of this page. About 5 minutes later the draft blog post and social posts appear there: check the photos and wording, edit anything, then press Approve. The blog post goes live right away and Facebook, the Instagram post and the Instagram story go out at the time you pick. The Google post is ready to copy and paste.'],
  ['Change photos, services or prices', 'Ask in that same folder, for example "swap the first photo on the 14 Thistle Ln post." Public website prices sync from HDPhotoHub; update package prices there. You approve the preview before anything goes live.'],
  ['Google Business posts', 'Ready-to-post text and photos for every shoot are in Downloads > ListingPixl-Google-Business, with a posting date for each in SCHEDULE.txt.'],
];

const NOT_SET_UP = [
  'Google now shows one verified profile and one duplicate; corrected active-profile details are under review',
  'Automatic Google Business posts (waiting on Google API access)',
  'Online payments and invoices',
  'Two-way SMS reply routing (HDPhotoHub review email: 12 hours; review text: 1 day after purchasing delivery)',
  'Bookkeeping',
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page() {
  const sections = SECTIONS.map(s => `
      <section class="dash-section">
        <h2>${esc(s.title)}</h2>
        <div class="dash-grid">${s.links.map(([name, url, note]) => `
          <a class="dash-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            <strong>${esc(name)}</strong>
            <span>${esc(note)}</span>
          </a>`).join('')}
        </div>
      </section>`).join('');
  const howTo = HOW_TO.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('');
  const todo = NOT_SET_UP.map(t => `<li>${esc(t)}</li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Team Dashboard | Listing Pixl</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .dash { max-width: 1080px; margin: 0 auto; padding: 2rem 16px 4rem; }
    .dash-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .dash-head img { height: 48px; width: auto; }
    .dash-head h1 { margin: 0; font-size: 1.6rem; }
    .dash-section { margin: 2rem 0; }
    .dash-section h2 { font-size: 1.15rem; margin: 0 0 0.75rem; text-align: left; }
    .dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
    .dash-card { display: flex; flex-direction: column; gap: 0.3rem; padding: 1rem 1.1rem; border: 1px solid var(--card-border, #e5e0d5); border-radius: 12px; background: var(--card, #fff); color: var(--ink, #1d1d1d); text-decoration: none; transition: border-color 0.15s ease, transform 0.15s ease; }
    .dash-card:hover, .dash-card:focus-visible { border-color: var(--accent-pink, #d63384); transform: translateY(-1px); }
    .dash-card strong { font-size: 1rem; }
    .dash-card span { font-size: 0.88rem; color: var(--muted, #666); }
    .dash-list { padding-left: 1.2rem; color: var(--muted, #555); }
    .dash-list li { margin: 0.5rem 0; }
    .dash-list strong { color: var(--ink, #1d1d1d); }
    .dash-todo { display: flex; flex-wrap: wrap; gap: 0.45rem; list-style: none; padding: 0; }
    .dash-todo li { border: 1px dashed var(--card-border, #ccc); border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.88rem; color: var(--muted, #666); }
${shoots.css}
    .dash-foot { margin-top: 3rem; font-size: 0.85rem; color: var(--muted, #666); }
  </style>
</head>
<body>
  <main class="dash">
    <div class="dash-head">
      <a href="/" aria-label="Listing Pixl home"><img src="/images/logo-horizontal-312.jpg" alt="Listing Pixl" width="156" height="66"></a>
      <h1>Team Dashboard</h1>
    </div>
${shoots.html}
    ${sections}
    <section class="dash-section">
      <h2>How to update the website</h2>
      <ul class="dash-list">${howTo}</ul>
    </section>
    <section class="dash-section">
      <h2>Not set up yet</h2>
      <ul class="dash-todo">${todo}</ul>
    </section>
    <p class="dash-foot">Links open in a new tab. Each service still asks for its own login. To sign out of this page, close the browser.</p>
  </main>
  <script>${shoots.script}</script>
</body>
</html>`;
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!process.env.STAFF_PASSWORD) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('The team dashboard is not set up yet: add STAFF_PASSWORD in Vercel > Settings > Environment Variables, then redeploy.');
  }
  if (!authorized(req)) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Listing Pixl team", charset="UTF-8"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Team login required.');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(page());
};


