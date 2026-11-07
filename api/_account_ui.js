// Account page content for /staff/account: basic information from
// known data, read-only. No password or driver's-license management —
// this app does not own that; to change these, use HD Photo Hub.
const css = `
    .ac-defs { display: grid; grid-template-columns: 160px 1fr; gap: 0.4rem 1rem; margin: 0; }
    .ac-defs dt { font-weight: 800; }
    .ac-defs dd { margin: 0; }
    .ac-note { color: var(--muted, #4f5b5e); margin: 0.75rem 0 0; }
`;

const html = `
    <section class="dash-panel dash-panel-teal" id="account">
      <div class="dash-panel-head"><h2>My Account</h2><p class="dash-panel-sub">Basic information, read-only.</p></div>
      <div class="dash-panel-body">
        <dl class="ac-defs">
          <dt>Name</dt><dd>William Macomber</dd>
          <dt>Phone</dt><dd>6097807027</dd>
          <dt>Email</dt><dd>ListingPixl.Media@gmail.com</dd>
          <dt>Website</dt><dd><a href="https://listingpixl.com" target="_blank" rel="noopener noreferrer">listingpixl.com</a></dd>
        </dl>
        <p class="ac-note">To change these, update them in HD Photo Hub — this page does not store a password or a driver's license. <a href="https://listingpixl.hd.pics/Account/" target="_blank" rel="noopener noreferrer">Edit in HD Photo Hub</a></p>
      </div>
    </section>
`;

module.exports = { css, html };
