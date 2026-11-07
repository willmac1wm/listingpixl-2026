// Single entry point for every /staff page (Nov 2026): the dashboard is
// one page per job — Dashboard, Sites, Photo Editing, Posts, Clients,
// CRM, Business, Account — but Vercel's Hobby plan allows no more than
// 12 Serverless Functions per deployment, and one function per page
// pushed this project to 19 and broke the build
// (exceeded_serverless_functions_per_deployment). So the eight page
// modules live in api/_pages/ (underscore-prefixed, not functions) and
// this one function dispatches to them by page name. Behaviour is
// unchanged: each page module still renders its own section through
// the shared shell, with its own sign-in redirect target.
//
// The page is picked from the ?page= query the vercel.json routes set,
// or from the request path itself (/staff/sites -> sites, /staff ->
// dashboard), so it works whether Vercel preserves the original URL
// through the rewrite or not. Unknown pages get a plain 404.
const PAGES = {
  dashboard: require('./_pages/dashboard'),
  sites: require('./_pages/sites'),
  studio: require('./_pages/studio'),
  posts: require('./_pages/posts'),
  clients: require('./_pages/clients'),
  crm: require('./_pages/crm'),
  business: require('./_pages/business'),
  account: require('./_pages/account'),
};

const BY_PATH = {
  '/staff': 'dashboard',
  '/staff/sites': 'sites',
  '/staff/studio': 'studio',
  '/staff/posts': 'posts',
  '/staff/clients': 'clients',
  '/staff/crm': 'crm',
  '/staff/business': 'business',
  '/staff/account': 'account',
};

function pageName(req) {
  try {
    const url = new URL(req.url || '/staff', 'http://x');
    const fromQuery = url.searchParams.get('page');
    if (fromQuery && PAGES[fromQuery]) return fromQuery;
    const path = url.pathname.replace(/\/$/, '') || '/staff';
    return BY_PATH[path] || null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  const name = pageName(req);
  if (!name) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('No such team page.');
  }
  return PAGES[name](req, res);
};
module.exports.pageName = pageName;
