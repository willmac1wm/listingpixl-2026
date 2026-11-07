// Account page (/staff/account): basic information, read-only. No
// password or driver's-license management — that lives in HD Photo Hub.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const account = require('./_account_ui');

function page() {
  return staffPage({
    title: 'Account', active: 'Account',
    sidebar: [['My Account', '/staff/account']],
    css: [account.css], body: account.html, scripts: [],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/account', {
  title: 'Account', active: 'Account',
  sidebar: [['My Account', '/staff/account']],
  css: [account.css], body: account.html, scripts: [],
});
module.exports.page = page;
