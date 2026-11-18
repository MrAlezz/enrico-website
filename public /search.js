(function () {
  'use strict';

  var input = document.getElementById('searchInput');
  if (!input) return;

  var form = input.closest('form') || input.parentNode;
  var PAGES = ['index.html', 'about.html', 'artworks.html'];
  var PAGE_LABEL = { 'index.html': 'Home', 'about.html': 'About', 'artworks.html': 'Artworks' };
  var MAX_RESULTS = 8;
  var MIN_CHARS = 2;
  var current = location.pathname.split('/').pop() || 'index.html';

  /* ---------- Styles (injected, so no CSS file is needed) ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.search-results{position:absolute;top:calc(100% + 10px);right:0;width:420px;max-width:92vw;max-height:70vh;overflow-y:auto;' +
    'background:var(--bg-panel,#181818);border:1px solid var(--border-light,#3d3d3d);border-radius:4px;' +
    'box-shadow:0 20px 50px rgba(0,0,0,.6);z-index:2500;display:none}' +
    '.search-results.open{display:block}' +
    '.sr-item{display:block;padding:.9rem 1.1rem;border-bottom:1px solid var(--border-color,#2a2a2a);transition:background .2s}' +
    '.sr-item:last-of-type{border-bottom:none}' +
    '.sr-item:hover,.sr-item.active{background:var(--bg-subtle,#222)}' +
    '.sr-type{display:block;font-family:var(--font-display,sans-serif);font-size:.8rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim,#7a7975)}' +
    '.sr-title{display:block;font-family:var(--font-display,sans-serif);font-size:1.3rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-main,#f5f4f0);line-height:1.2;margin:.15rem 0}' +
    '.sr-snippet{display:block;font-size:.82rem;line-height:1.5;font-weight:300;color:var(--text-muted,#ababab)}' +
    '.search-results mark{background:transparent;color:var(--accent-crema,#e8e4d9);font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
    '.sr-empty,.sr-note{padding:1rem 1.1rem;font-size:.85rem;color:var(--text-muted,#ababab)}' +
    '.sr-note{border-top:1px solid var(--border-color,#2a2a2a);font-size:.75rem;color:var(--text-dim,#7a7975)}' +
    '@media (max-width:900px){.search-results{position:fixed;left:1rem;right:1rem;top:calc(var(--header-height,85px) + 8px);width:auto;max-width:none}}';
  document.head.appendChild(style);

  var panel = document.createElement('div');
  panel.className = 'search-results';
  panel.setAttribute('role', 'listbox');
  panel.id = 'searchResults';
  form.appendChild(panel);
  input.setAttribute('aria-controls', 'searchResults');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('placeholder', 'Search the site...');

  /* ---------- Helpers ---------- */
  function norm(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function clean(nodeOrText) {
    var t = typeof nodeOrText === 'string' ? nodeOrText : (nodeOrText ? nodeOrText.textContent : '');
    return t.replace(/\s+/g, ' ').trim();
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isPlaceholder(el) {
    return !el || el.classList.contains('placeholder');
  }

  /* ---------- Build the index from a document ---------- */
  function extract(doc, file) {
    var items = [];

    function add(o) {
      if (!o.title) return;
      o.file = file;
      o.hay = norm(o.title + ' ' + o.text);
      o.ntitle = norm(o.title);
      items.push(o);
    }

    // Artworks (index / artworks page)
    doc.querySelectorAll('.work-card').forEach(function (card) {
      var t = card.querySelector('.panel__title');
      add({
        type: 'Artwork',
        title: clean(t),
        text: [
          clean(card.querySelector('.panel__eyebrow')),
          clean(card.querySelector('.panel__sub')),
          clean(card.querySelector('.work-desc'))
        ].filter(Boolean).join(' — '),
        hash: card.id ? '#' + card.id : '#opere'
      });
    });

    // Artist profile (about page)
    var profile = doc.getElementById('profile');
    if (profile) {
      add({
        type: 'Profile',
        title: clean(profile.querySelector('.about__name')) || 'Artist Profile',
        text: clean(profile.querySelector('.about__bio')) + ' ' + clean(profile.querySelector('.about__list')),
        hash: '#profile'
      });
    }

    // Generic content sections (about / other pages)
    doc.querySelectorAll('.page-section[id], section[id]').forEach(function (sec) {
      if (sec.id === 'opere' || sec.id === 'contatti' || sec.id === 'top') return;
      var titleEl = sec.querySelector('.page-section__title, .opere-title-group h2, .about__name');
      var title = clean(titleEl) || sec.id;
      var c = sec.cloneNode(true);
      c.querySelectorAll('.placeholder,.timeline,.card-grid,.info-card,.page-section__title,script,style').forEach(function (n) { n.remove(); });
      add({ type: 'Section', title: title, text: clean(c), hash: '#' + sec.id });
    });

    // Contact section
    var contact = doc.getElementById('contatti');
    if (contact) {
      var cc = contact.cloneNode(true);
      cc.querySelectorAll('form,.contact__title,script,style').forEach(function (n) { n.remove(); });
      add({ type: 'Contact', title: 'Contact', text: clean(cc), hash: '#contatti' });
    }

    return items;
  }

  var indexPromise = null;
  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = (async function () {
      var items = [];
      var partial = false;
      for (var i = 0; i < PAGES.length; i++) {
        var file = PAGES[i];
        if (file === current) {
          items = items.concat(extract(document, file));
          continue;
        }
        try {
          var res = await fetch(file, { cache: 'no-cache' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var html = await res.text();
          var doc = new DOMParser().parseFromString(html, 'text/html');
          items = items.concat(extract(doc, file));
        } catch (e) {
          partial = true;
        }
      }
      return { items: items, partial: partial };
    })();
    return indexPromise;
  }

  /* ---------- Search & rank ---------- */
  function tokensOf(q) {
    return norm(q).split(/\s+/).filter(Boolean);
  }

  function runSearch(items, toks) {
    var out = [];
    items.forEach(function (it) {
      var score = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (it.hay.indexOf(t) === -1) return;
        if (it.ntitle.indexOf(t) !== -1) score += 10;
        if (it.ntitle.indexOf(t) === 0) score += 5;
        score += 1;
      }
      if (it.ntitle === toks.join(' ')) score += 20;
      out.push({ item: it, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, MAX_RESULTS).map(function (r) { return r.item; });
  }

  function highlight(text, toks) {
    var n = norm(text);
    if (n.length !== text.length) return esc(text);
    var ranges = [];
    toks.forEach(function (t) {
      var from = 0, idx;
      while ((idx = n.indexOf(t, from)) !== -1) {
        ranges.push([idx, idx + t.length]);
        from = idx + t.length;
      }
    });
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0]];
    for (var i = 1; i < ranges.length; i++) {
      var last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
      else merged.push(ranges[i]);
    }
    var html = '', pos = 0;
    merged.forEach(function (r) {
      html += esc(text.slice(pos, r[0])) + '<mark>' + esc(text.slice(r[0], r[1])) + '</mark>';
      pos = r[1];
    });
    return html + esc(text.slice(pos));
  }

  function snippet(text, toks) {
    if (!text) return '';
    var n = norm(text);
    var first = -1;
    toks.forEach(function (t) {
      var i = n.indexOf(t);
      if (i !== -1 && (first === -1 || i < first)) first = i;
    });
    var LEN = 110;
    var start = first > 40 ? first - 40 : 0;
    var s = text.slice(start, start + LEN);
    return (start > 0 ? '… ' : '') + s + (start + LEN < text.length ? ' …' : '');
  }

  /* ---------- Rendering ---------- */
  var active = -1;

  function hrefFor(it) {
    if (it.href) return it.href;
    return (it.file === current ? '' : it.file) + (it.hash || '');
  }

  function render(results, toks, q, partial) {
    var html = '';
    if (!results.length) {
      html += '<div class="sr-empty">No results for “' + esc(q) + '”</div>';
    } else {
      results.forEach(function (it, i) {
        var h = hrefFor(it);
        var ext = it.external ? ' target="_blank" rel="noopener"' : '';
        html +=
          '<a class="sr-item" role="option" data-i="' + i + '" href="' + esc(h || '#') + '"' + ext + '>' +
            '<span class="sr-type">' + esc(it.type) + ' · ' + esc(PAGE_LABEL[it.file] || it.file) + '</span>' +
            '<span class="sr-title">' + highlight(it.title, toks) + '</span>' +
            '<span class="sr-snippet">' + highlight(snippet(it.text, toks), toks) + '</span>' +
          '</a>';
      });
    }
    if (partial) {
      html += '<div class="sr-note">Showing results from this page only. Other pages can be searched when the site is opened from a web server.</div>';
    }
    panel.innerHTML = html;
    panel.classList.add('open');
    active = -1;
  }

  function close() {
    panel.classList.remove('open');
    active = -1;
  }

  var seq = 0;
  async function update() {
    var q = input.value.trim();
    if (q.length < MIN_CHARS) { close(); return; }
    var mine = ++seq;
    var data = await loadIndex();
    if (mine !== seq) return;
    var toks = tokensOf(q);
    render(runSearch(data.items, toks), toks, q, data.partial);
  }

  function setActive(i) {
    var links = panel.querySelectorAll('.sr-item');
    if (!links.length) return;
    active = (i + links.length) % links.length;
    links.forEach(function (l, idx) { l.classList.toggle('active', idx === active); });
    links[active].scrollIntoView({ block: 'nearest' });
  }

  /* ---------- Events ---------- */
  input.addEventListener('input', update);
  input.addEventListener('focus', function () {
    loadIndex();
    if (input.value.trim().length >= MIN_CHARS) update();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Escape') { close(); input.blur(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var links = panel.querySelectorAll('.sr-item');
      var target = links[active >= 0 ? active : 0];
      if (target) target.click();
    }
  });

  panel.addEventListener('click', function (e) {
    var a = e.target.closest('.sr-item');
    if (!a) return;
    close();
    input.value = '';
    input.blur();
  });

  document.addEventListener('click', function (e) {
    if (!form.contains(e.target)) close();
  });
})();