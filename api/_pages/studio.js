// Recipe Studio page (/staff/studio): the Studio moved whole from the
// old single-page dashboard. Same four steps, same chain-anchor run,
// same model grid, same closed-door settings — only the page it lives
// on changed.
const { serveStaffPage, staffPage } = require('../_staff_shell');
const studio = require('../_recipes_ui');

function page() {
  return staffPage({
    title: 'Photo Editing', active: 'Photo Editing',
    sidebar: [['Recipe Studio', '/staff/studio'], ['Recent batches', '/staff/studio#rc-batches'], ['Recipe settings — advanced', '/staff/studio#rc-settings-door']],
    css: [studio.css], body: studio.html, scripts: [studio.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/studio', {
  title: 'Photo Editing', active: 'Photo Editing',
  sidebar: [['Recipe Studio', '/staff/studio'], ['Recent batches', '/staff/studio#rc-batches'], ['Recipe settings — advanced', '/staff/studio#rc-settings-door']],
  css: [studio.css], body: studio.html, scripts: [studio.script],
});
module.exports.page = page;
