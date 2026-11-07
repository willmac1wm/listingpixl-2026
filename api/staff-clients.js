// Clients page (/staff/clients): one table built from delivery shoots
// and HD Photo Hub sites. Client creation stays in HD Photo Hub.
const { serveStaffPage, staffPage } = require('./_staff_shell');
const clients = require('./_clients_ui');

function page() {
  return staffPage({
    title: 'Clients', active: 'Clients',
    sidebar: [['All clients', '/staff/clients'], ['Create a New Client', 'https://listingpixl.hd.pics/Clients/search.asp', true]],
    css: [clients.css], body: clients.html, scripts: [clients.script],
  });
}

module.exports = async (req, res) => serveStaffPage(req, res, '/staff/clients', {
  title: 'Clients', active: 'Clients',
  sidebar: [['All clients', '/staff/clients'], ['Create a New Client', 'https://listingpixl.hd.pics/Clients/search.asp', true]],
  css: [clients.css], body: clients.html, scripts: [clients.script],
});
module.exports.page = page;
