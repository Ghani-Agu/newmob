(() => {
  const $ = (sel) => document.querySelector(sel);

  // Tiny element builder. Text goes through textContent, so store data is never parsed as HTML.
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) el.append(c);
    return el;
  }

  const arrow = (d) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return s;
  };

  let store;
  let money = (n) => String(n);

  // ---------- Hero ----------
  function heroText(item, tag = 'h1') {
    return h('div', { class: 'slide__text' },
      h(tag, { class: 'hero__title', text: item.title }),
      item.text ? h('p', { class: 'hero__text', text: item.text }) : null,
      item.cta ? h('a', { class: 'btn', href: item.link || '#shop', text: item.cta }) : null,
    );
  }

  function renderSlider(hero, slides) {
    const root = $('#hero');
    root.className = 'hero hero--slider';
    const track = h('div', { class: 'slides' });
    const dots = h('div', { class: 'hero__dots' });

    slides.forEach((s, i) => {
      track.append(h('div', { class: 'slide', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${slides.length}` },
        h('div', { class: 'container slide__inner' },
          heroText(s, i === 0 ? 'h1' : 'h2'),
          h('div', { class: 'slide__media' }, h('img', { src: s.image, alt: s.title, loading: i === 0 ? 'eager' : 'lazy' })),
        ),
      ));
      dots.append(h('button', { class: 'hero__dot', 'aria-label': `Slide ${i + 1}`, onclick: () => go(i, true) }));
    });

    root.replaceChildren(track);
    if (slides.length > 1) {
      root.append(
        dots,
        h('button', { class: 'hero__arrow hero__arrow--prev', 'aria-label': 'Previous', onclick: () => go(index - 1, true) }, arrow('M15 6l-6 6 6 6')),
        h('button', { class: 'hero__arrow hero__arrow--next', 'aria-label': 'Next', onclick: () => go(index + 1, true) }, arrow('M9 6l6 6-6 6')),
      );
    }

    let index = 0;
    let timer;
    const delay = Math.max(2, Number(hero.interval) || 5) * 1000;

    function go(i, user) {
      index = (i + slides.length) % slides.length;
      [...track.children].forEach((el, n) => el.classList.toggle('is-active', n === index));
      [...dots.children].forEach((el, n) => el.classList.toggle('is-active', n === index));
      if (user) restart();
    }
    function restart() {
      clearInterval(timer);
      if (slides.length > 1) timer = setInterval(() => go(index + 1), delay);
    }

    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', restart);
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : restart()));

    // Swipe on touch screens.
    let startX = null;
    root.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), true);
      startX = null;
    });

    go(0);
    restart();
  }

  function renderVideo(video) {
    const root = $('#hero');
    root.className = 'hero hero--video' + (video.textColor === 'light' ? ' is-light' : '');
    const el = h('video', { src: video.src, poster: video.poster || null, autoplay: true, muted: true, loop: true, playsinline: true, preload: 'auto', 'aria-hidden': 'true' });
    el.muted = true; // the attribute alone is not enough for autoplay in some browsers
    root.replaceChildren(
      el,
      video.title ? h('div', { class: 'container hero__overlay' }, heroText(video)) : null,
    );
    el.play?.().catch(() => {});
  }

  function renderHero() {
    const hero = store.hero || {};
    const slides = (hero.slides || []).filter((s) => s.image || s.title);
    if (hero.mode === 'video' && hero.video?.src) renderVideo(hero.video);
    else if (slides.length) renderSlider(hero, slides);
    else $('#hero').remove();
  }

  // ---------- Shop ----------
  let filter = 'All';

  function renderFilters() {
    const cats = ['All', ...new Set(store.products.map((p) => p.category).filter(Boolean))];
    $('#filters').replaceChildren(...cats.map((c) =>
      h('button', { class: 'filter' + (c === filter ? ' is-active' : ''), role: 'tab', 'aria-selected': String(c === filter), text: c, onclick: () => setFilter(c) })));
    $('#nav').replaceChildren(...cats.slice(1).map((c) =>
      h('a', { href: '#shop', text: c, onclick: () => setFilter(c) })));
  }

  function setFilter(c) {
    filter = c;
    renderFilters();
    renderGrid();
  }

  function renderGrid() {
    const items = store.products.filter((p) => filter === 'All' || p.category === filter);
    $('#grid').replaceChildren(...(items.length ? items.map((p) =>
      h('button', { class: 'card', onclick: () => openQuick(p) },
        h('div', { class: 'card__media' },
          h('img', { src: p.image, alt: p.name, loading: 'lazy' }),
          p.tag ? h('span', { class: 'card__tag' + (/sale/i.test(p.tag) ? ' card__tag--sale' : ''), text: p.tag }) : null,
        ),
        h('p', { class: 'card__name', text: p.name }),
        h('p', { class: 'card__price', text: money(p.price) }),
      )) : [h('p', { class: 'empty', text: 'Nothing here yet.' })]));
  }

  // ---------- Quick view with zoom ----------
  const quick = $('#quick');
  const media = $('#quick-media');
  const img = $('#quick-img');
  let current;

  function openQuick(p) {
    current = p;
    img.src = p.image;
    img.alt = p.name;
    $('#quick-cat').textContent = p.category || '';
    $('#quick-name').textContent = p.name;
    $('#quick-price').textContent = money(p.price);
    media.classList.remove('is-zoomed');
    quick.showModal();
  }

  function moveZoom(e) {
    const r = media.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  }
  media.addEventListener('click', (e) => { moveZoom(e); media.classList.toggle('is-zoomed'); });
  media.addEventListener('mousemove', moveZoom);
  media.addEventListener('mouseleave', () => media.classList.remove('is-zoomed'));
  $('#quick-close').addEventListener('click', () => quick.close());
  quick.addEventListener('click', (e) => { if (e.target === quick) quick.close(); });
  $('#quick-add').addEventListener('click', () => {
    if (current) addToBag(current);
    quick.close();
  });

  // ---------- Bag (count only, kept in this browser) ----------
  function bagCount() {
    try { return Number(localStorage.getItem('newmob-bag')) || 0; } catch { return 0; }
  }
  function showBag(n) {
    const el = $('#bag-count');
    el.textContent = n;
    el.hidden = n === 0;
  }
  function addToBag() {
    const n = bagCount() + 1;
    try { localStorage.setItem('newmob-bag', n); } catch { /* storage blocked */ }
    showBag(n);
  }

  // ---------- Init ----------
  window.addEventListener('scroll', () => $('#header').classList.toggle('is-scrolled', scrollY > 8), { passive: true });

  fetch('/api/store', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      store = data;
      store.products ||= [];
      const cur = store.currency || '$';
      money = (n) => `${cur}${Number(n).toLocaleString()}`;
      if (store.brand) {
        document.title = store.brand;
        $('#logo').textContent = store.brand;
        $('#footer-brand').textContent = store.brand;
      }
      renderHero();
      renderFilters();
      renderGrid();
      showBag(bagCount());
    })
    .catch(() => { $('#grid').replaceChildren(h('p', { class: 'empty', text: 'Could not load products.' })); });
})();
