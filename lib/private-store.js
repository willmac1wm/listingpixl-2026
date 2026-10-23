const blob = require('@vercel/blob');
const { createHash } = require('node:crypto');

function namespace() {
  const env = process.env.VERCEL_ENV || 'development';
  return env === 'production' ? 'production' : env + '/' + createHash('sha256').update(process.env.VERCEL_GIT_COMMIT_REF || 'local').digest('hex').slice(0, 12);
}
function fullPath(path) {
  if (!/^[a-zA-Z0-9_./-]*$/.test(path) || path.includes('..')) throw Error('Invalid storage path');
  return 'listingpixl/' + namespace() + '/' + path;
}
function configured() { return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN); }
function isConflict(error) { return error instanceof blob.BlobPreconditionFailedError; }
function timeout() { return AbortSignal.timeout(7000); }

async function read(path) {
  const result = await blob.get(fullPath(path), { access: 'private', useCache: false, abortSignal: timeout() });
  if (!result) return null;
  if (result.statusCode !== 200) throw Error('Private record unavailable');
  return { value: await new Response(result.stream).json(), etag: result.blob.etag };
}
async function write(path, value, etag) {
  const result = await blob.put(fullPath(path), JSON.stringify(value), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false,
    allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}), abortSignal: timeout(),
  });
  return { value, etag: result.etag };
}
async function create(path, value) {
  try { return { ...(await write(path, value)), created: true }; }
  catch (error) {
    // A repeated request may already have saved its copy. Never overwrite it.
    const existing = await read(path);
    if (existing) return { ...existing, created: false };
    throw error;
  }
}
async function list(prefix, { cursor, limit = 50 } = {}) {
  const result = await blob.list({ prefix: fullPath(prefix), limit, ...(cursor ? { cursor } : {}), abortSignal: timeout() });
  const root = fullPath('');
  return { items: result.blobs.map(item => ({ path: item.pathname.slice(root.length), uploadedAt: item.uploadedAt })), cursor: result.hasMore ? result.cursor : null };
}
async function remove(path, etag) {
  return blob.del(fullPath(path), { ...(etag ? { ifMatch: etag } : {}), abortSignal: timeout() });
}
module.exports = { configured, isConflict, read, write, create, list, remove };
