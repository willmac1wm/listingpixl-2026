// Blog/social drafts page (/staff/posts): the "New shoots" section
// moved whole from the old single-page dashboard. Same draft cards,
// per-channel blocks, Google hand-post steps and Approve area.
const { serveStaffPage, staffPage } = require('../_staff_shell');
const shoots = require('../_shoots_ui');

function page() {
  return staffPage({
    title: 'Posts', active: 'Posts',
    sidebar: [['New shoots', '/staff/posts'], ['Blog: every shoot', 'https://www.listingpixl.com/blog/', true]],
    css: [shoots.css], body: shoots.html, scripts: [shoots.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/posts', {
  title: 'Posts', active: 'Posts',
  sidebar: [['New shoots', '/staff/posts'], ['Blog: every shoot', 'https://www.listingpixl.com/blog/', true]],
  css: [shoots.css], body: shoots.html, scripts: [shoots.script],
});
module.exports.page = page;
