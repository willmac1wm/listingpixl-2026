// Editing page (/staff/editing): the little editing section around the
// Recipe Studio — a light queue tracker, nothing more. Per-shoot queue,
// status to-edit / editing / done, who is doing the editing, due time
// with a late flag. Creating a job or moving it starts nothing.
const { serveStaffPage, staffPage } = require('../_staff_shell');
const editing = require('../_editing_ui');

function page() {
  return staffPage({
    title: 'Editing', active: 'Editing',
    sidebar: [['Queue', '/staff/editing'], ['New job', '/staff/editing#ed-new'], ['Recent batches', '/staff/editing#ed-batches']],
    css: [editing.css], body: editing.html, scripts: [editing.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/editing', {
  title: 'Editing', active: 'Editing',
  sidebar: [['Queue', '/staff/editing'], ['New job', '/staff/editing#ed-new'], ['Recent batches', '/staff/editing#ed-batches']],
  css: [editing.css], body: editing.html, scripts: [editing.script],
});
module.exports.page = page;
