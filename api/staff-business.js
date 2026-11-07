// Business Summary page (/staff/business): business name, owner,
// domains, stat panels from real data only, and Team Members. The
// other 19 HD Business sidebar items are not built — no data or
// function behind them here.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const business = require('./_business_ui');

function page() {
  return staffPage({
    title: 'Business', active: 'Business',
    sidebar: [['Business Summary', '/staff/business']],
    css: [business.css], body: business.html, scripts: [business.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/business', {
  title: 'Business', active: 'Business',
  sidebar: [['Business Summary', '/staff/business']],
  css: [business.css], body: business.html, scripts: [business.script],
});
module.exports.page = page;
