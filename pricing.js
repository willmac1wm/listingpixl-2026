// Prices are public and always visible, never hidden until checkout.
// They are read from the public HDPhotoHub menu, never from a client session;
// when that live fetch fails, /api/prices returns the verified fallback
// menu, and a visible price is always kept — never replaced with
// "See checkout".
(function () {
  const fields = [...document.querySelectorAll('[data-hd-price]')];
  if (!fields.length) return;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const fresh = (el, maxAge) => {
    const age = Date.now() - Date.parse(el.dataset.priceCheckedAt || '');
    return Number.isFinite(age) && age >= -60000 && age <= maxAge;
  };
  let refreshing = false;
  async function refresh() {
    // Server-rendered prices have already been checked. Avoid a second request
    // on arrival and retain that verified menu through a refresh outage.
    if (refreshing || fields.every(el => fresh(el, 300000))) return;
    refreshing = true;
    try {
      const response = await fetch('/api/prices', { signal: AbortSignal.timeout(16000) });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      // The verified fallback menu is a published public price list, not a
      // live check, so its checkedAt date is not an expiry.
      if (!data.fallback) {
        const age = Date.now() - Date.parse(data.checkedAt || '');
        if (!Number.isFinite(age) || age < -60000 || age > 600000 || data.currency !== 'USD') throw new Error('Expired prices');
      }
      // Validate the entire visible menu before updating any prices.
      if (fields.some(el => !Number.isFinite(data.prices?.[el.dataset.hdPrice]?.price) || data.prices[el.dataset.hdPrice].price <= 0)) throw new Error('Incomplete prices');
      fields.forEach(el => {
        el.textContent = money.format(data.prices[el.dataset.hdPrice].price) + (el.dataset.priceUnit || '');
        el.dataset.priceCheckedAt = data.checkedAt;
      });
    } catch (_) {
      // Never hide a price: keep whatever is already showing, even if it is
      // old. There is no "See checkout" fallback any more.
    } finally { refreshing = false; }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 300000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
