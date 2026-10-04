(() => {
  const $ = (sel) => document.querySelector(sel);

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) el.append(c);
    return el;
  }

  const icon = (d) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    return s;
  };
  const ICON = { up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' };

  let key = '';
  try { key = sessionStorage.getItem('newmob-admin') || ''; } catch { /* storage blocked */ }
  let store;
  let dirty = false;

  function toast(msg, error) {
    const t = h('div', { class: 'toast' + (error ? ' toast--error' : ''), text: msg });
    document.body.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  function markDirty() {
    dirty = true;
    $('#status').textContent = 'Unsaved changes';
  }

  // ---------- Auth ----------
  async function login(password) {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'x-admin-key': password } });
    return r.ok;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#password').value;
    if (await login(pw)) {
      key = pw;
      try { sessionStorage.setItem('newmob-admin', pw); } catch { /* storage blocked */ }
      start();
    } else {
      $('#login-error').textContent = 'Wrong password';
      $('#login-error').hidden = false;
    }
  });

  // ---------- Upload ----------
  async function upload(file) {
    const r = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'x-admin-key': key, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  // ---------- Field helpers ----------
  function text(obj, prop, label, type = 'text') {
    return h('label', { class: 'field' }, label,
      h('input', { class: 'input', type, value: obj[prop] ?? '', oninput: (e) => {
        obj[prop] = type === 'number' ? Number(e.target.value) : e.target.value;
        markDirty();
      } }));
  }

  function select(obj, prop, label, options) {
    const el = h('select', { class: 'input', onchange: (e) => { obj[prop] = e.target.value; markDirty(); } },
      options.map(([v, t]) => h('option', { value: v, text: t })));
    el.value = obj[prop] || options[0][0];
    return h('label', { class: 'field' }, label, el);
  }

  // Square image picker: click to upload, preview shown on the same white as the site.
  function thumb(obj, prop) {
    const preview = () => (obj[prop] ? h('img', { src: obj[prop], alt: '' }) : h('span', { text: 'Add image' }));
    const input = h('input', { type: 'file', accept: 'image/*' });
    const box = h('label', { class: 'thumb', title: 'Click to upload' }, preview(), input);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      box.classList.add('is-loading');
      try {
        obj[prop] = await upload(file);
        box.replaceChildren(preview(), input);
        markDirty();
      } catch (err) {
        toast(err.message, true);
      } finally {
        box.classList.remove('is-loading');
        input.value = '';
      }
    });
    return box;
  }

  // URL field with an upload button (used for video and poster).
  function mediaField(obj, prop, label, accept, onChange) {
    const input = h('input', { class: 'input', value: obj[prop] ?? '', placeholder: '/uploads/…  or  https://…', oninput: (e) => {
      obj[prop] = e.target.value;
      markDirty();
      onChange?.();
    } });
    const file = h('input', { type: 'file', accept, hidden: true });
    const btn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: 'Upload', onclick: () => file.click() });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      btn.textContent = 'Uploading…';
      btn.disabled = true;
      try {
        obj[prop] = input.value = await upload(file.files[0]);
        markDirty();
        onChange?.();
      } catch (err) {
        toast(err.message, true);
      } finally {
        btn.textContent = 'Upload';
        btn.disabled = false;
        file.value = '';
      }
    });
    return h('label', { class: 'field' }, label, h('div', { class: 'media-field' }, input, btn, file));
  }

  function tools(list, i, rerender) {
    const move = (to) => {
      [list[i], list[to]] = [list[to], list[i]];
      markDirty();
      rerender();
    };
    return h('div', { class: 'row__tools' },
      h('button', { class: 'icon-btn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i - 1) }, icon(ICON.up)),
      h('button', { class: 'icon-btn', 'aria-label': 'Move down', disabled: i === list.length - 1, onclick: () => move(i + 1) }, icon(ICON.down)),
      h('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Remove', onclick: () => {
        list.splice(i, 1);
        markDirty();
        rerender();
      } }, icon(ICON.trash)),
    );
  }

  // ---------- Sections ----------
  function renderMode() {
    const mode = store.hero.mode;
    document.querySelectorAll('input[name=mode]').forEach((r) => { r.checked = r.value === mode; });
    $('#slider-panel').hidden = mode !== 'slider';
    $('#video-panel').hidden = mode !== 'video';
  }

  function renderSlides() {
    const list = store.hero.slides;
    $('#slides').replaceChildren(...list.map((s, i) =>
      h('div', { class: 'row' },
        thumb(s, 'image'),
        h('div', { class: 'row__fields' },
          text(s, 'title', 'Title'),
          text(s, 'text', 'Line under title'),
          text(s, 'cta', 'Button'),
          text(s, 'link', 'Button link'),
        ),
        tools(list, i, renderSlides),
      )));
  }

  function renderVideo() {
    const v = store.hero.video;
    const preview = $('#video-preview');
    const refresh = () => {
      if (v.src && preview.getAttribute('src') !== v.src) preview.src = v.src;
      if (!v.src) preview.removeAttribute('src');
      preview.poster = v.poster || '';
    };
    $('#video-fields').replaceChildren(
      mediaField(v, 'src', 'Video (mp4 / webm)', 'video/mp4,video/webm', refresh),
      mediaField(v, 'poster', 'Poster image (shown while loading)', 'image/*', refresh),
      text(v, 'title', 'Title'),
      text(v, 'text', 'Line under title'),
      text(v, 'cta', 'Button'),
      text(v, 'link', 'Button link'),
      select(v, 'textColor', 'Text color', [['dark', 'Dark (light video)'], ['light', 'Light (dark video)']]),
    );
    refresh();
  }

  function renderProducts() {
    const list = store.products;
    $('#products').replaceChildren(...list.map((p, i) =>
      h('div', { class: 'row' },
        thumb(p, 'image'),
        h('div', { class: 'row__fields' },
          text(p, 'name', 'Name'),
          text(p, 'category', 'Category'),
          text(p, 'price', 'Price', 'number'),
          text(p, 'tag', 'Tag (New, Sale…)'),
        ),
        tools(list, i, renderProducts),
      )));
  }

  function renderGeneral() {
    $('#general').replaceChildren(text(store, 'brand', 'Store name'), text(store, 'currency', 'Currency symbol'));
  }

  // ---------- Wire up ----------
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
    store.hero.mode = r.value;
    markDirty();
    renderMode();
  }));
  $('#interval').addEventListener('input', (e) => { store.hero.interval = Number(e.target.value) || 5; markDirty(); });
  $('#add-slide').addEventListener('click', () => {
    store.hero.slides.push({ title: 'New slide', text: '', image: '', cta: 'Shop now', link: '#shop' });
    markDirty();
    renderSlides();
  });
  $('#add-product').addEventListener('click', () => {
    store.products.push({ name: 'New product', category: '', price: 0, image: '', tag: '' });
    markDirty();
    renderProducts();
  });

  $('#save').addEventListener('click', async () => {
    const btn = $('#save');
    btn.disabled = true;
    try {
      const r = await fetch('/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify(store),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) return logout();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      dirty = false;
      $('#status').textContent = 'Saved';
      toast('Saved');
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

  function logout() {
    try { sessionStorage.removeItem('newmob-admin'); } catch { /* storage blocked */ }
    location.reload();
  }

  async function start() {
    store = await (await fetch('/api/store', { cache: 'no-store' })).json();
    store.hero ||= {};
    store.hero.mode ||= 'slider';
    store.hero.slides ||= [];
    store.hero.video ||= {};
    store.products ||= [];
    $('#login').hidden = true;
    $('#editor').hidden = false;
    $('#interval').value = store.hero.interval || 5;
    renderMode();
    renderSlides();
    renderVideo();
    renderProducts();
    renderGeneral();
  }

  if (key) login(key).then((ok) => (ok ? start() : logout()));
})();
