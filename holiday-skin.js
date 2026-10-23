/* Listing Pixl seasonal layer. No dependencies, layout edits, replaced photos,
 * external assets, tracking, sound, or page-wide filters. Not loaded by index.html.
 * Shadow DOM isolates both styles and the preview controls from the website.
 */
(function () {
  'use strict';
  const THEMES = ['off', 'halloween', 'thanksgiving', 'winter', 'newyear', 'valentine', 'independence'];
  const NAMES = { off: 'Original website', halloween: 'Halloween', thanksgiving: 'Thanksgiving', winter: 'Winter holidays', newyear: 'New Year', valentine: 'Valentine’s Day', independence: 'Independence Day' };
  function easternDay(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
  function holidayForDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'off';
    const [year, month, date] = day.split('-').map(Number);
    const valid = new Date(Date.UTC(year, month - 1, date));
    if (valid.toISOString().slice(0, 10) !== day) return 'off';
    if ((month === 12 && date >= 27) || (month === 1 && date <= 3)) return 'newyear';
    if (month === 12 && date <= 26) return 'winter';
    if (month === 10 && date >= 20) return 'halloween';
    if (month === 11) {
      const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
      const thanksgiving = 1 + (4 - first + 7) % 7 + 21; // fourth Thursday
      if (date >= thanksgiving - 3 && date <= thanksgiving + 3) return 'thanksgiving';
    }
    if (month === 2 && date >= 10 && date <= 14) return 'valentine';
    if (month === 7 && date <= 4) return 'independence';
    return 'off';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { easternDay, holidayForDay };
  if (typeof document === 'undefined' || document.querySelector('listing-pixl-holiday-skin')) return;
  if (document.currentScript?.hasAttribute('data-managed') && !document.documentElement.hasAttribute('data-lp-seasonal-on')) return;

  const demo = Boolean(document.currentScript && document.currentScript.hasAttribute('data-preview'));
  const params = new URLSearchParams(location.search);
  let mode = demo && THEMES.includes(params.get('theme')) ? params.get('theme') : 'auto';
  let day = demo && /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : easternDay();
  let previewDate = demo && params.has('date');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let moving = !reducedMotion.matches;
  const host = document.createElement('listing-pixl-holiday-skin');
  host.style.cssText = 'position:fixed;inset:0;display:block;pointer-events:none;z-index:60;contain:layout style;';
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const SVG = (content, view = '0 0 120 120') => `<svg viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${content}</svg>`;
  const pumpkin = SVG('<path d="M61 29q-8-17 7-23" stroke="#898b61" stroke-width="7" stroke-linecap="round"/><path d="M61 28c-47-17-65 44-35 67 15 11 29 7 35 5 21 9 48-3 50-32 2-28-22-50-50-40Z" fill="#ce722d"/><ellipse cx="61" cy="66" rx="25" ry="37" fill="#e49643"/><path d="M61 31v66M37 35c-15 22-12 47 1 60m46-60c15 22 12 47-1 60" stroke="#824f2c" stroke-width="2" opacity=".45"/><path d="m38 57 12-7-1 14Zm45 0-12-7 1 14ZM44 76q17 14 34 0" fill="#492438"/>');
  const web = SVG('<path d="M1 1h115M1 1v115M1 1l108 47M1 1l81 81M1 1l47 108M24 1q-7 14-23 23m46-23Q36 32 1 47m71-46Q57 56 1 72m96-71Q80 80 1 97M15 7q-5 12-8 8m28 0q-6 17-20 20m40-12q-10 25-32 32m53-23Q58 61 32 76m65-35Q71 75 41 97" stroke="currentColor" stroke-width="1.1" opacity=".5"/>');
  const leaf = SVG('<path d="M57 110C12 90 2 44 25 12c26 23 70 2 78 42 4 24-18 39-46 56Z" fill="currentColor"/><path d="M56 109 48 35m6 48L26 62m24-4 22-19" stroke="#624738" stroke-width="2" opacity=".5"/>');
  const star = SVG('<path d="m60 9 10 37 40 14-40 11-10 40-11-40L9 60l40-14Z" fill="currentColor"/>');
  const snow = SVG('<path d="M60 5v110M12 32l96 56M12 88l96-56M44 17l16 15 16-15M44 103l16-15 16 15M16 50l22-4-7-22m58 72-7-22 22-4M31 96l7-22-22-4m88-20-22-4 7-22" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>');
  const heart = SVG('<path d="M60 104 16 62C-10 29 28-5 60 29 92-5 130 29 104 62Z" fill="currentColor"/>');
  const bat = SVG('<path d="M59 48c-4-8-12-10-12-10l-1 13C28 37 12 40 2 56c17-1 21 8 25 16 14-12 22-6 32 8 10-14 18-20 32-8 4-8 8-17 25-16-10-16-26-19-44-5l-1-13s-8 2-12 10Z" fill="currentColor"/>');
  const styles = `<style>
    :host{--warm:#eb9d4b;--cool:#e3458a;--edge:20px;--head:74px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
    *,*:before,*:after{box-sizing:border-box}.decor{position:fixed;inset:0;overflow:hidden;pointer-events:none;user-select:none}
    .rim{position:absolute;inset:0;border:2px solid transparent;border-image:linear-gradient(140deg,var(--warm),transparent 35%,transparent 65%,var(--cool)) 1;opacity:.66}
    .halo{position:absolute;width:160px;height:310px;filter:blur(52px);opacity:.14;background:var(--warm);top:calc(var(--head) + 26px);left:-142px;border-radius:50%}.halo.r{left:auto;right:-142px;top:auto;bottom:120px;background:var(--cool)}
    .corner{position:absolute;width:clamp(36px,var(--edge),100px);color:var(--warm);filter:drop-shadow(0 5px 12px #101b2638)}
    .corner svg,.particle svg{display:block;width:100%;height:100%}.top{top:calc(var(--head) + 10px);left:8px}.top.r{left:auto;right:8px;transform:scaleX(-1)}
    .bottom{bottom:22px;left:12px}.bottom.r{left:auto;right:12px;transform:scaleX(-1)}.web{opacity:.7}.pumpkin{width:clamp(34px,var(--edge),92px)}
    .particle{position:absolute;width:13px;height:13px;color:var(--warm);left:5px;top:0;opacity:0;animation:drift 18s linear infinite;animation-delay:calc(var(--i)*-3.2s)}
    .particle.right{left:auto;right:5px;color:var(--cool)}.particle:nth-child(3n){width:9px;height:9px}.bat{width:25px;height:20px;color:#ac92c5}
    @keyframes drift{0%{transform:translateY(calc(var(--head) + 20px)) rotate(-15deg);opacity:0}12%,85%{opacity:.52}100%{transform:translateY(105vh) rotate(170deg);opacity:0}}
    [data-motion=off] .particle{animation:none;opacity:.45;top:calc(14vh + var(--i)*13vh)}
    [data-theme=winter]{--warm:#b6e5e9;--cool:#e7cfa2}[data-theme=newyear]{--warm:#d6b565;--cool:#e659a1}[data-theme=thanksgiving]{--warm:#c88745;--cool:#af8871}[data-theme=valentine]{--warm:#eaa4c4;--cool:#d71266}[data-theme=independence]{--warm:#e17381;--cool:#76bcca}
    .lights{position:absolute;top:var(--head);left:0;right:0;height:6px;background:radial-gradient(ellipse at center,#e8bf70 0 15%,transparent 55%) 0 0/70px 8px repeat-x;opacity:.75}
    .panel{position:fixed;bottom:max(18px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);pointer-events:auto;background:#142733f2;border:1px solid #49717d;border-radius:16px;box-shadow:0 15px 45px #07172240;padding:14px 18px;width:min(760px,calc(100vw - 28px));backdrop-filter:blur(16px);font-size:13px;line-height:1.4;color:#e6f0f3}
    .line{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.title{font-size:14px;font-weight:750;letter-spacing:.01em}.tag{color:#a3d6dd;border:1px solid #527b85;border-radius:99px;padding:3px 8px;font-size:10px;letter-spacing:.09em;text-transform:uppercase}.hint{color:#b9ccd3;font-size:12px;margin:8px 0 0}
    .tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}label{display:flex;gap:7px;align-items:center}select,input,button{font:inherit;color:#f8fcff;background:#24424f;border:1px solid #72909c;border-radius:7px;padding:6px 8px;min-height:34px}button{cursor:pointer}button:hover{background:#385b68}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #ffc57a;outline-offset:3px}button.off{margin-left:auto;border-color:#d281a8;background:#61324c}input{color-scheme:dark;max-width:155px}.mini{font-size:11px;color:#bed3db}#status{margin:0;color:#c5dce2}.compact .tools,.compact .hint{display:none}.toggle{margin-left:auto;background:transparent;min-height:26px;padding:2px 7px}
    @media(max-width:700px){.corner{display:none}.particle{width:8px;height:8px;left:2px}.particle.right{right:2px}.bat{width:14px}.halo{opacity:.07}.panel{padding:10px 12px;bottom:8px;border-radius:12px}.tools{gap:7px}label{gap:4px}input{max-width:135px}.title{font-size:13px}.hint{font-size:11px}.rim{border-width:1px}}
    @media(prefers-reduced-motion:reduce){.particle{animation:none!important;opacity:.4;top:calc(14vh + var(--i)*13vh)}}
    @media print{:host{display:none}}
  </style>`;
  root.innerHTML = styles + '<div id="decoration" class="decor" aria-hidden="true"></div>';
  const decoration = root.getElementById('decoration');
  let panel, select, dateInput, status, motion;
  if (demo) {
    panel = document.createElement('aside');
    panel.className = 'panel';
    panel.setAttribute('aria-label', 'Holiday skin preview controls');
    panel.innerHTML = `<div class="line"><span class="title">Seasonal, still Listing Pixl.</span><span class="tag">Preview only</span><button class="toggle" type="button" aria-expanded="true">Minimize</button></div><div class="tools"><label>Skin <select aria-label="Holiday skin"><option value="auto">Automatic calendar</option>${THEMES.map(t => `<option value="${t}">${NAMES[t]}</option>`).join('')}</select></label><label>Test date <input type="date" aria-label="Preview date" /></label><button id="motion" type="button">Motion on</button><button class="off" id="original" type="button">Original</button><p id="status" role="status"></p></div><p class="hint">Same page, photos, prices and buttons. Decoration follows the viewport and keeps clear of the content. Automatic dates use New Jersey time.</p>`;
    root.append(panel);
    select = panel.querySelector('select'); dateInput = panel.querySelector('input');
    status = root.getElementById('status'); motion = root.getElementById('motion');
    select.value = mode; dateInput.value = day;
    select.addEventListener('change', () => { mode = select.value; render(); });
    dateInput.addEventListener('change', () => { if (dateInput.value) { day = dateInput.value; previewDate = true; mode = 'auto'; select.value = mode; render(); } });
    motion.addEventListener('click', () => { moving = !moving; render(); });
    root.getElementById('original').addEventListener('click', () => { mode = 'off'; select.value = mode; render(); });
    panel.querySelector('.toggle').addEventListener('click', e => {
      const minimized = panel.classList.toggle('compact');
      e.currentTarget.textContent = minimized ? 'Expand' : 'Minimize';
      e.currentTarget.setAttribute('aria-expanded', String(!minimized));
    });
  }
  function render() {
    const theme = mode === 'auto' ? holidayForDay(day) : mode;
    host.dataset.theme = theme;
    decoration.dataset.theme = theme;
    decoration.dataset.motion = moving && !reducedMotion.matches ? 'on' : 'off';
    decoration.replaceChildren();
    if (theme !== 'off') {
      const shape = theme === 'halloween' ? bat : theme === 'thanksgiving' ? leaf : theme === 'winter' ? snow : theme === 'valentine' ? heart : star;
      decoration.innerHTML = '<div class="rim"></div><div class="halo"></div><div class="halo r"></div>' +
        (theme === 'halloween' ? `<div class="corner top web">${web}</div><div class="corner top r web">${web}</div><div class="corner bottom pumpkin">${pumpkin}</div><div class="corner bottom r pumpkin">${pumpkin}</div>` :
          `<div class="corner top">${shape}</div><div class="corner bottom r">${shape}</div>`) +
        (theme === 'winter' || theme === 'newyear' ? '<div class="lights"></div>' : '') +
        Array.from({ length: 8 }, (_, i) => `<div class="particle ${i % 2 ? 'right' : ''} ${theme === 'halloween' ? 'bat' : ''}" style="--i:${i}">${shape}</div>`).join('');
    }
    if (status) status.textContent = `${mode === 'auto' ? 'Auto · ' : ''}${NAMES[theme]}`;
    if (motion) { motion.textContent = reducedMotion.matches ? 'Reduced motion' : moving ? 'Motion on' : 'Motion off'; motion.disabled = reducedMotion.matches; }
  }
  let layoutFrame;
  function fit() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      const header = document.querySelector('.site-header, header');
      const headerBottom = header ? Math.max(0, Math.min(180, header.getBoundingClientRect().bottom)) : 0;
      // Ornaments fit inside outer gutters. On narrow layouts, only edge trim remains.
      const content = document.querySelector('main .wrap') || document.querySelector('.wrap') || document.querySelector('main');
      const rect = content && content.getBoundingClientRect();
      const gutter = rect ? Math.min(rect.left, innerWidth - rect.right) : (innerWidth - 1100) / 2;
      host.style.setProperty('--edge', `${Math.max(0, Math.min(100, gutter - 16))}px`);
      host.style.setProperty('--head', `${headerBottom}px`);
      host.toggleAttribute('data-tight', gutter < 56);
    });
  }
  const tightStyle = document.createElement('style');
  tightStyle.textContent = ':host([data-tight]) .corner{display:none}'; root.append(tightStyle);
  const observer = new ResizeObserver(fit); observer.observe(document.documentElement);
  const header = document.querySelector('.site-header, header'); if (header) observer.observe(header);
  const mutations = new MutationObserver(fit); mutations.observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', fit, { passive: true });
  reducedMotion.addEventListener('change', render);
  // Refresh the calendar for a page left open over midnight, without a reload.
  const calendarTimer = setInterval(() => {
    if (document.hidden || previewDate) return;
    const next = easternDay();
    if (next !== day) { day = next; if (dateInput) dateInput.value = day; render(); }
  }, 60000);
  const stop = () => {
    clearInterval(calendarTimer); cancelAnimationFrame(layoutFrame);
    observer.disconnect(); mutations.disconnect();
    removeEventListener('resize', fit); reducedMotion.removeEventListener('change', render);
    host.remove();
  };
  addEventListener('listingpixl:seasonal-off', stop, { once: true });
  render(); fit();
})();
