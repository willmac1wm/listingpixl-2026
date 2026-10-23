const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calendar = require('../holiday-skin');
const settings = require('../lib/seasonal-settings');

test('holiday calendar follows Eastern midnight, moving Thanksgiving and year boundaries', () => {
  assert.equal(calendar.easternDay(new Date('2026-10-20T03:59:00Z')), '2026-10-19');
  assert.equal(calendar.holidayForDay(calendar.easternDay(new Date('2026-10-20T03:59:00Z'))), 'off');
  assert.equal(calendar.holidayForDay(calendar.easternDay(new Date('2026-10-20T04:00:00Z'))), 'halloween');
  assert.equal(calendar.holidayForDay('2026-10-31'), 'halloween');
  assert.equal(calendar.holidayForDay('2026-11-01'), 'off');
  assert.equal(calendar.holidayForDay('2026-11-23'), 'thanksgiving');
  assert.equal(calendar.holidayForDay('2026-11-22'), 'off');
  assert.equal(calendar.holidayForDay('2027-11-22'), 'thanksgiving');
  assert.equal(calendar.holidayForDay('2026-12-26'), 'winter');
  assert.equal(calendar.holidayForDay('2026-12-27'), 'newyear');
  assert.equal(calendar.holidayForDay('2027-01-03'), 'newyear');
  assert.equal(calendar.holidayForDay('2027-01-04'), 'off');
  assert.equal(calendar.holidayForDay('2026-02-30'), 'off');
});

test('team setting persists across reads and refuses anonymous or cross-site changes', async () => {
  let record = null;
  const storage = {
    read: async () => record,
    write: async (path, value) => { record = { value, etag: 'v1' }; },
  };
  const scoped = { read: () => settings.read(storage), save: value => settings.save(value, storage) };
  assert.equal((await scoped.read()).enabled, false);
  const box = { module: { exports: {} }, require: name => name === './_auth' ? {
    authorized: async req => req.headers.authorization === 'test-team',
    sameOrigin: req => req.headers.origin === 'https://preview.example' && req.headers.host === 'preview.example',
  } : scoped };
  vm.runInNewContext(fs.readFileSync('api/seasonal.js', 'utf8'), box);
  const call = async (method, headers = {}, body) => {
    let code, data;
    const res = { setHeader() {}, status(value) { code = value; return this; }, end(value) { data = value ? JSON.parse(value) : null; } };
    await box.module.exports({ method, headers, body }, res);
    return { code, data };
  };
  assert.equal((await call('GET')).data.enabled, false);
  assert.equal((await call('POST', {}, { enabled: true })).code, 401);
  const headers = { authorization: 'test-team', origin: 'https://preview.example', host: 'preview.example', 'x-staff': '1', 'content-type': 'application/json' };
  assert.equal((await call('POST', { ...headers, origin: 'https://untrusted.example' }, { enabled: true })).code, 403);
  assert.equal((await call('POST', headers, { enabled: 'true' })).code, 400);
  assert.equal((await call('POST', headers, { enabled: true })).code, 200);
  assert.deepEqual((await call('GET')).data, { enabled: true });
  assert.equal((await call('POST', headers, { enabled: false })).code, 200);
  assert.deepEqual((await call('GET')).data, { enabled: false });
  assert.equal((await call('DELETE', headers)).code, 405);
});

test('live loader stops existing decoration if the switch is off or settings become unavailable', async () => {
  let enabled = true, fail = false, mounted = false, check, removed = 0, stopped = 0, appended = 0;
  const attributes = new Set();
  const doc = {
    hidden: false,
    documentElement: { setAttribute: key => attributes.add(key), removeAttribute: key => attributes.delete(key) },
    querySelector: () => mounted ? { remove() { removed++; mounted = false; } } : null,
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { append() { appended++; mounted = true; } },
    addEventListener() {},
  };
  const context = { document: doc, AbortSignal, Event, addEventListener() {}, dispatchEvent() { stopped++; }, setInterval(fn) { check = fn; },
    fetch: async () => { if (fail) throw Error('Offline'); return { ok: true, json: async () => ({ enabled }) }; },
  };
  vm.runInNewContext(fs.readFileSync('seasonal-loader.js', 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(appended, 1); assert.ok(attributes.has('data-lp-seasonal-on'));
  enabled = false; await check();
  assert.equal(stopped, 1); assert.equal(attributes.size, 0);
  enabled = true; await check(); assert.equal(appended, 2);
  fail = true; await check();
  assert.equal(stopped, 2); assert.equal(attributes.size, 0); assert.ok(removed);
});

test('holiday demo renders the current homepage and live-price fields without analytics', async () => {
  let output, headers = {};
  const original = fs.readFileSync('index.html', 'utf8');
  const context = { module: { exports: {} }, process,
    require: name => name === '../lib/public-prices' ? { getPublicPrices: async () => ({}), renderPrices: html => html } : require(name),
  };
  vm.runInNewContext(fs.readFileSync('api/holiday-preview.js', 'utf8'), context);
  await context.module.exports({ method: 'GET' }, { setHeader(key, value) { headers[key] = value; }, status() { return this; }, end(value) { output = value; } });
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal((output.match(/data-hd-price=/g) || []).length, 13);
  assert.ok(output.includes(original.match(/<main[\s\S]*?<\/main>/)[0]));
  assert.match(output, /holiday-skin\.js/);
  assert.doesNotMatch(output, /fbevents\.js|googletagmanager\.com|gtag\('config'/);
  assert.doesNotMatch(original, /holiday-skin\.js|seasonal-loader\.js/);
});
