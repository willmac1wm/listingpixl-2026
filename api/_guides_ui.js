// Learning Center content for the /staff Dashboard: the link panels
// (Run the business, Get found online, Website), the numbered how-to
// steps, and the not-set-up-yet list. Moved whole from the old
// single-page dashboard (api/staff.js) when the dashboard split into
// pages — wording and links unchanged. It lives at the bottom of the
// Dashboard, HD's Learning Center pattern. No script: this is links and
// reading only.
//
// To add a link, add a line to SECTIONS below and push.
const businessLinks = require('../config/business-links.json');

const SECTIONS = [
  {
    title: 'Run the business',
    sub: 'Inbox, orders, calls and email — the daily tools.',
    tint: 'teal',
    links: [
      ['Website inquiry inbox', '/staff/inquiries', 'Private saved copies, delivery status and recovery for website questions'],
      ['HD Photo Hub admin', 'https://listingpixl.hd.pics/ux/studio/Dashboard', 'Orders, uploads, deliveries and client galleries'],
      ['Client site (HD Photo Hub)', 'https://listingpixl.hd.pics/Dashboard/', 'What agents see when they log in'],
      ['AI phone receptionist (Smith.ai)', 'https://app.smith.ai/', 'Call log, messages, greeting and call forwarding'],
      ['Business email', 'https://mail.google.com/', 'ListingPixl.Media@gmail.com, where website questions arrive'],
    ],
  },
  {
    title: 'Get found online',
    sub: 'Profiles, posts and search — where customers find you.',
    tint: 'blue',
    links: [
      ['Google Business Profile', 'https://business.google.com/locations', 'Posts, photos, hours, reviews and messages'],
      ['See our Google listing', businessLinks.googleMaps, 'How the profile looks to customers on Maps'],
      ['Facebook page', 'https://www.facebook.com/listing.pixl.media/', 'The public page'],
      ['Meta Business Suite', 'https://business.facebook.com/', 'Facebook and Instagram posts, reels, messages and ads'],
      ['Google Search Console', 'https://search.google.com/search-console', 'What people search to find the site; submit the sitemap'],
      ['Google Analytics', 'https://analytics.google.com/', 'Website visitors and contact-form leads'],
    ],
  },
  {
    title: 'Website',
    sub: 'The live site, hosting, files and domain.',
    tint: 'grey',
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
  ['Start in the right place', [
    'In Claude Code, start a new session in the listingpixl-2026 folder (Documents > GitHub > listingpixl-2026).',
    'Any session there knows how the site works, because the instructions are saved in the project on GitHub.',
    'If that folder is ever missing, start a session anywhere and ask it to clone github.com/willmac1wm/listingpixl-2026 into Documents/GitHub.',
  ]],
  ['New shoot on the blog, Google, Facebook and Instagram', [
    'Pick the shoot on the Posts page.',
    'About 5 minutes later the draft blog post and social posts appear there.',
    'Check the photos and wording, edit anything, then press Approve.',
    'The blog post goes live right away.',
    'Facebook, the Instagram post and the Instagram story go out at the time you pick.',
    'The Google post is ready to copy and paste.',
  ]],
  ['Change photos, services or prices', [
    'Ask in that same folder, for example "swap the first photo on the 14 Thistle Ln post."',
    'Public website prices sync from HDPhotoHub; update package prices there.',
    'You approve the preview before anything goes live.',
  ]],
  ['Google Business posts', [
    'Ready-to-post text and photos for every shoot are in Downloads > ListingPixl-Google-Business, with a posting date for each in SCHEDULE.txt.',
  ]],
];

const NOT_SET_UP = [
  'Google now shows one verified profile and one duplicate; corrected active-profile details are under review',
  'Automatic Google Business posts (waiting on Google API access)',
  'Online payments and invoices',
  'Two-way SMS reply routing (HDPhotoHub review email: 12 hours; review text: 1 day after purchasing delivery)',
  'Bookkeeping',
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const sections = SECTIONS.map(s => `
      <section class="dash-panel dash-panel-${s.tint}">
        <div class="dash-panel-head"><h2>${esc(s.title)}</h2><p class="dash-panel-sub">${esc(s.sub)}</p></div>
        <div class="dash-panel-body"><div class="dash-grid">${s.links.map(([name, url, note]) => `
          <a class="dash-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            <strong>${esc(name)}</strong>
            <span>${esc(note)}</span>
          </a>`).join('')}
        </div></div>
      </section>`).join('');
const howTo = HOW_TO.map(([t, lines], i) => `<li><span class="dash-step-num">${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(t)}</strong>${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div></li>`).join('');
const todo = NOT_SET_UP.map(t => `<li>${esc(t)}</li>`).join('');

const html = `
    ${sections}
    <section class="dash-panel dash-panel-teal">
      <div class="dash-panel-head"><h2>How to update the website</h2><p class="dash-panel-sub">Four things you will actually do here — each one in short steps.</p></div>
      <div class="dash-panel-body"><ol class="dash-steps">${howTo}</ol></div>
    </section>
    <section class="dash-panel dash-panel-grey">
      <div class="dash-panel-head"><h2>Not set up yet</h2><p class="dash-panel-sub">Still waiting on something else — none of these are part of the daily flow.</p></div>
      <div class="dash-panel-body"><ul class="dash-todo">${todo}</ul></div>
    </section>
`;

module.exports = { css: '', html };
