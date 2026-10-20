// Listing Pixl shared behavior: nav, contact tracking, scroll reveal,
// featured-shoot slider, photo lightbox. Loaded with `defer` on every page.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Count phone / text / email taps as contacts in Meta + GA
  document.querySelectorAll('a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]').forEach(a => {
    a.addEventListener('click', () => {
      const method = a.href.startsWith('tel:') ? 'phone' : a.href.startsWith('sms:') ? 'text' : 'email';
      if (window.fbq) fbq('track', 'Contact');
      if (window.gtag) gtag('event', 'contact', { method });
    });
  });

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    const setMenu = open => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setMenu(!links.classList.contains('open')));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  }

  // Header gets a shadow once the page scrolls
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Scroll reveal. Only content below the fold is hidden first, so nothing
  // already on screen flickers and the hero is never delayed.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const targets = document.querySelectorAll(
      '.section h2, .section-lede, .service-card, .package-card, .alacarte, .feature-carousel, .work-tile, ' +
      '.work-trust, .work-cta, .area-map, .map-key, .town-list, .about-text, .faq, .contact-details, ' +
      '#booking-form, .blog-card, .blog-photo, article .wrap.narrow > p, .post-cta');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    const fold = window.innerHeight;
    targets.forEach(el => {
      if (el.getBoundingClientRect().top < fold) return;
      const sibs = el.parentElement ? [...el.parentElement.children] : [el];
      el.style.setProperty('--reveal-delay', (Math.max(0, sibs.indexOf(el)) % 4) * 80 + 'ms');
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // Featured-shoot slider: swipe, arrows, dots, and a pausable auto-advance
  document.querySelectorAll('.feature-carousel').forEach(root => {
    const track = root.querySelector('.fc-track');
    const slides = [...track.children];
    const dots = [...root.querySelectorAll('.fc-dot')];
    const pause = root.querySelector('.fc-pause');
    const count = root.querySelector('.fc-count');
    let current = 0, timer = null, userPaused = reduceMotion, hovering = false, inView = false;

    const go = (i, smooth = true) => {
      current = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[current].offsetLeft - track.offsetLeft, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    };
    const mark = i => {
      current = i;
      dots.forEach((d, j) => d.setAttribute('aria-current', j === i ? 'true' : 'false'));
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
      slides.forEach((s, j) => s.toggleAttribute('inert', j !== i));
    };
    const run = () => {
      clearInterval(timer); timer = null;
      if (!userPaused && !hovering && inView && !document.hidden) timer = setInterval(() => go(current + 1), 6000);
    };
    root.querySelector('.fc-prev').addEventListener('click', () => go(current - 1));
    root.querySelector('.fc-next').addEventListener('click', () => go(current + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    pause.addEventListener('click', () => {
      userPaused = !userPaused;
      pause.setAttribute('aria-pressed', String(userPaused));
      pause.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      run();
    });
    if (reduceMotion) { pause.setAttribute('aria-pressed', 'true'); pause.setAttribute('aria-label', 'Play slideshow'); }
    root.addEventListener('mouseenter', () => { hovering = true; run(); });
    root.addEventListener('mouseleave', () => { hovering = false; run(); });
    root.addEventListener('focusin', () => { hovering = true; run(); });
    root.addEventListener('focusout', () => { hovering = false; run(); });
    track.addEventListener('pointerdown', () => { hovering = true; run(); }, { passive: true });
    document.addEventListener('visibilitychange', run);
    const slideIO = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) mark(slides.indexOf(e.target));
    }), { root: track, threshold: 0.6 });
    slides.forEach(s => slideIO.observe(s));
    new IntersectionObserver(es => { inView = es[0].isIntersecting; run(); }, { threshold: 0.3 }).observe(root);
    mark(0);
  });

  // Photo lightbox for blog galleries: tap a photo, then swipe / arrow keys
  const gallery = document.querySelector('.blog-gallery');
  if (gallery && window.HTMLDialogElement) {
    const items = [...gallery.querySelectorAll('a.blog-photo-link')];
    const box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Photo viewer');
    box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<button type="button" class="lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(box);
    const img = box.querySelector('img'), cap = box.querySelector('figcaption');
    let at = 0;
    const show = i => {
      at = (i + items.length) % items.length;
      const src = items[at].querySelector('img');
      img.classList.remove('is-in');
      img.src = items[at].href; img.alt = src.alt;
      cap.textContent = (at + 1) + ' / ' + items.length;
      requestAnimationFrame(() => img.classList.add('is-in'));
    };
    items.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); show(i); box.showModal(); }));
    box.querySelector('.lb-close').addEventListener('click', () => box.close());
    box.querySelector('.lb-prev').addEventListener('click', () => show(at - 1));
    box.querySelector('.lb-next').addEventListener('click', () => show(at + 1));
    box.addEventListener('click', e => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
    let x0 = null;
    box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
    });
  }

  // Service examples: run each card's animation, video or before/after sweep
  // only while it is on screen; videos load the first time they are seen.
  const svcMedia = document.querySelectorAll('.svc-media');
  if (svcMedia.length) {
    const setLive = (el, live) => {
      el.classList.toggle('is-live', live && !reduceMotion);
      const v = el.querySelector('video');
      if (!v || reduceMotion) return;
      if (live) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else if (v.src) v.pause();
    };
    if ('IntersectionObserver' in window) {
      const svcIO = new IntersectionObserver(es => es.forEach(e => setLive(e.target, e.isIntersecting)), { threshold: 0.35 });
      svcMedia.forEach(el => svcIO.observe(el));
    } else svcMedia.forEach(el => setLive(el, true));

    // Before/after: sweeps back and forth by itself until someone drags it
    document.querySelectorAll('.svc-compare').forEach(box => {
      const range = box.querySelector('.svc-range');
      let auto = !reduceMotion, t0 = null;
      const set = pct => box.style.setProperty('--pos', pct + '%');
      const tick = now => {
        if (!auto) return;
        if (box.classList.contains('is-live')) {
          t0 = t0 ?? now;
          set((50 + 42 * Math.sin((now - t0) / 1100)).toFixed(1));
        }
        requestAnimationFrame(tick);
      };
      if (auto) requestAnimationFrame(tick);
      range.addEventListener('input', () => { auto = false; set(range.value); });
    });
  }

  // Keep the mobile Call / Text / Book bar out of the way while typing
  const form = document.getElementById('booking-form');
  if (form) {
    form.addEventListener('focusin', () => document.body.classList.add('is-typing'));
    form.addEventListener('focusout', () => document.body.classList.remove('is-typing'));
  }
})();
