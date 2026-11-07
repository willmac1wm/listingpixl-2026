// CRM / delivery page (/staff/crm): the delivery CRM moved whole from
// the old single-page dashboard. Same per-shoot records, statuses,
// Stripe links, tour/video URLs, gallery links and draft texts.
// Drafts only — nothing on this page sends anything.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const delivery = require('./_delivery_ui');

function page() {
  return staffPage({
    title: 'CRM', active: 'CRM',
    sidebar: [['All shoots', '/staff/crm']],
    css: [delivery.css], body: delivery.html, scripts: [delivery.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/crm', {
  title: 'CRM', active: 'CRM',
  sidebar: [['All shoots', '/staff/crm']],
  css: [delivery.css], body: delivery.html, scripts: [delivery.script],
});
module.exports.page = page;
