// Prices are read from the public HDPhotoHub menu, never from a client session.
(function () {
  const fields = [...document.querySelectorAll('[data-hd-price]')];
  if (!fields.length) return;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  async function refresh() {
    try {
      const response = await fetch('/api/prices', { signal: AbortSignal.timeout(16000) });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (!data.checkedAt || Date.now() - Date.parse(data.checkedAt) > 600000 || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error('Expired prices');
      // Validate the entire visible menu before updating any prices.
      if (fields.some(el => !Number.isFinite(data.prices?.[el.dataset.hdPrice]?.price))) throw new Error('Incomplete prices');
      fields.forEach(el => { el.textContent = money.format(data.prices[el.dataset.hdPrice].price) + (el.dataset.priceUnit || ''); });
    } catch (_) {
      fields.forEach(el => {
        const link = document.createElement('a');
        link.href = 'https://listingpixl.hd.pics/order';
        link.textContent = 'See checkout';
        el.replaceChildren(link);
      });
    }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 300000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
