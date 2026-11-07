// Sites page (/staff/sites): HD Photo Hub sites as HD-style cards.
// Search, sort, and a link out to HD for creating a new site — site
// creation is not rebuilt here.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const sites = require('./_sites_ui');

function page() {
  return staffPage({
    title: 'Sites', active: 'Sites',
    sidebar: [['All sites', '/staff/sites'], ['Create a New Real Estate Site', 'https://listingpixl.hd.pics/Sites/search.asp', true]],
    css: [sites.css], body: sites.html, scripts: [sites.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/sites', {
  title: 'Sites', active: 'Sites',
  sidebar: [['All sites', '/staff/sites'], ['Create a New Real Estate Site', 'https://listingpixl.hd.pics/Sites/search.asp', true]],
  css: [sites.css], body: sites.html, scripts: [sites.script],
});
module.exports.page = page;
