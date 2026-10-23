// The master switch is checked separately from cached homepage HTML.
// Off removes an existing layer within the next 30-second visible-page check.
(function () {
  'use strict';
  let checking = false, script;
  function off() {
    document.documentElement.removeAttribute('data-lp-seasonal-on');
    dispatchEvent(new Event('listingpixl:seasonal-off'));
    document.querySelector('listing-pixl-holiday-skin')?.remove();
    script?.remove(); script = null;
  }
  async function check() {
    if (document.hidden || checking) return;
    checking = true;
    try {
      const response = await fetch('/api/seasonal', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
      if (!response.ok || (await response.json()).enabled !== true) { off(); return; }
      document.documentElement.setAttribute('data-lp-seasonal-on', '');
      if (!script && !document.querySelector('listing-pixl-holiday-skin')) {
        script = document.createElement('script'); script.src = '/holiday-skin.js'; script.dataset.managed = '';
        script.onerror = off; document.head.append(script);
      }
    } catch { off(); }
    finally { checking = false; }
  }
  check(); setInterval(check, 30000);
  document.addEventListener('visibilitychange', check);
  addEventListener('focus', check);
})();
