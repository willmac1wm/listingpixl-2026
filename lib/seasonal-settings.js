// Private, environment-separated state. Preview switches cannot affect production.
const store = require('./private-store');
const PATH = 'settings/seasonal.json';

async function read(storage = store) {
  const current = await storage.read(PATH);
  return { enabled: current?.value?.enabled === true, updatedAt: current?.value?.updatedAt || null };
}
async function save(enabled, storage = store) {
  if (typeof enabled !== 'boolean') throw new TypeError('Enabled must be true or false.');
  const current = await storage.read(PATH);
  const value = { enabled, updatedAt: new Date().toISOString() };
  await storage.write(PATH, value, current?.etag);
  return value;
}
module.exports = { read, save };
