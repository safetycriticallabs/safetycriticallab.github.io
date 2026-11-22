/* THE AREA KEY (2026-11-21). Where a page names a requirement area in its
   running text, "AI-6", the name becomes a link to that area's requirements.
   Resting the pointer on it, a first tap on a touch screen, or reaching it
   with the keyboard opens a small card: the framework page's system with its
   bodies standing in their row and that one lit, the area's name and the
   failure it prevents in the framework page's own words, and the two ways on.

   A page takes part by loading this file. Nothing here runs on a page that
   does not, and a page needs no markup of its own. To keep a passage out of
   it, put data-area-key="off" on the element that holds the passage.

   Left alone on purpose: headings, anything that is already a link or a
   control, the nav and the footer, and a requirement number such as AI-4.7,
   which names one requirement and not an area. A link a page already has to
   /requirements#ai-n keeps its look and gains the card. */
(function () {
  'use strict';

  /* THE LIST IS THE FRAMEWORK PAGE'S LIST: the AREAS array in framework.html,
     copied word for word, so the card never says anything that page does not.
     A version change that adds, renames or rewords an area changes both
     (VERSION-BUMP.md, step c). The drawing counts its bodies from this list
     and nothing below assumes how many there are. */
  var AREAS = [
    { n: 1, label: 'Operational and data foundations', prevents: 'A system evaluated on data it effectively trained on, reporting skill it does not have outside its declared operating domain.' },
    { n: 2, label: 'Addressing AI bias', prevents: 'Outcomes that are systematically worse for some users because the training data encoded a historical bias.' },
    { n: 3, label: 'ML test coverage', prevents: 'Strong average performance that hides untested edge cases, boundary conditions, and injected failure modes.' },
    { n: 4, label: 'Continuous validation', prevents: 'A model accurate at deployment quietly drifting wrong as the world changes around it.' },
    { n: 5, label: 'Hallucination prevention', prevents: 'An AI stating fabricated facts, policies, or values with the same confidence as correct ones.' },
    { n: 6, label: 'Out-of-distribution detection', prevents: 'The model meeting an input unlike anything it was trained on and responding as if it were routine.' },
    { n: 7, label: 'Adversarial robustness', prevents: 'Inputs, training data, or the model itself manipulated by an adversary to force a chosen failure.' },
    { n: 8, label: 'Explainability', prevents: 'A safety-critical decision that cannot be inspected, questioned, or justified after the fact.' },
    { n: 9, label: 'Human-AI teaming', prevents: 'Operators who over-trust, under-trust, or lose the authority to override the AI when it matters.' },
    { n: 10, label: 'Privacy and data protection', prevents: 'Personal or protected data exposed, retained, or transferred without lawful basis or control.' },
    { n: 11, label: 'Multi-model systems', conditional: true, prevents: 'One model’s error cascading through a chain of models into a system-level failure.' },
    { n: 12, label: 'Neural networks', conditional: true, prevents: 'Network-specific failures: miscalibrated confidence, brittle features, and unverified deployment transforms.' },
    { n: 13, label: 'Continuous learning and adaptation', conditional: true, prevents: 'A model that keeps learning after deployment teaching itself the wrong thing, unnoticed.' }
  ];

  if (!window.PointerEvent || !document.createTreeWalker || !Element.prototype.closest) return;

  var BY = {}, PLACE = {};
  AREAS.forEach(function (a, i) { BY[a.n] = a; PLACE[a.n] = i; });

  /* The look. A name at rest is the text it sits in with a dotted line under
     it; a name that is the whole of a tag keeps the tag's look. The card is a
     piece of the framework page's night sky and takes its type from that
     page's area cards. It sits under the nav, as everything on the site does. */
  var CSS = [
    'a.ak-t{color:inherit;white-space:nowrap;text-decoration-line:underline;text-decoration-style:dotted;text-decoration-thickness:1px;text-underline-offset:0.2em;text-decoration-color:currentColor;text-decoration-color:color-mix(in srgb,currentColor 55%,transparent);}',
    'a.ak-t:hover,a.ak-t.is-on{text-decoration-style:solid;text-decoration-color:currentColor;}',
    'a.ak-t.ak-tag{text-decoration-line:none;}',
    '.ak-card{position:absolute;left:0;top:0;z-index:150;box-sizing:border-box;width:340px;max-width:calc(100vw - 24px);margin:0;padding:0;overflow:hidden;background:#050E1C;color:#FAF9F5;border:1px solid rgba(214,226,242,0.16);border-radius:var(--radius-card,14px);box-shadow:0 18px 42px rgba(12,34,66,0.26),0 2px 10px rgba(12,34,66,0.18);font-family:var(--sans,"DM Sans",system-ui,sans-serif);font-size:14px;font-weight:400;line-height:1.4;letter-spacing:0;text-align:left;text-transform:none;white-space:normal;opacity:0;transform:translateY(4px);transition:opacity 0.14s ease,transform 0.14s ease;}',
    '.ak-card[hidden]{display:none;}',
    '.ak-card.is-up{transform:translateY(-4px);}',
    '.ak-card.is-open{opacity:1;transform:none;}',
    '.ak-sky{display:block;line-height:0;}',
    '.ak-sky svg{display:block;width:100%;height:auto;}',
    '.ak-words{padding:14px 18px 0;}',
    '.ak-id{display:flex;align-items:center;gap:8px;font-family:var(--mono,"DM Sans",system-ui,sans-serif);font-size:12px;font-weight:500;line-height:1.2;letter-spacing:0.06em;color:rgba(214,226,242,0.84);}',
    '.ak-scope{display:inline-block;font-size:10px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;padding:2px 7px;border:1px solid rgba(250,249,245,0.42);border-radius:2px;color:rgba(250,249,245,0.84);}',
    '.ak-scope[hidden]{display:none;}',
    '.ak-name{margin:7px 0 12px;font-size:20px;font-weight:600;line-height:1.12;letter-spacing:-0.015em;color:#FAF9F5;}',
    '.ak-label{margin:0 0 5px;font-family:var(--mono,"DM Sans",system-ui,sans-serif);font-size:10px;font-weight:500;line-height:1.3;letter-spacing:0.18em;text-transform:uppercase;color:rgba(214,226,242,0.82);}',
    '.ak-line{margin:0;font-size:14.5px;font-weight:500;line-height:1.42;color:#FAF9F5;}',
    '.ak-go{display:flex;gap:20px;margin:14px 18px 0;padding:12px 0 15px;border-top:1px solid rgba(214,226,242,0.14);}',
    '.ak-go a{position:relative;font-size:13px;font-weight:500;line-height:1.3;color:rgba(214,226,242,0.9);text-decoration:none;border-bottom:1px solid rgba(214,226,242,0.35);}',
    '.ak-go a::after{content:"";position:absolute;left:-9px;right:-9px;top:-11px;bottom:-12px;}',
    '.ak-go a:hover{color:#FAF9F5;border-bottom-color:currentColor;}',
    '.ak-go a:focus-visible{outline:2px solid #DCB34B;outline-offset:3px;border-radius:2px;}',
    '@media (prefers-reduced-motion: reduce){.ak-card,.ak-card.is-up{transition:none;transform:none;}}',
    '@media print{.ak-card{display:none !important;}a.ak-t{text-decoration-line:none;}}'
  ].join('\n');

  /* THE DRAWING. The system as the framework page draws it for its tiers: the
     mark as the sun, one orbit to an area, the plane seen at a slant and lying
     on its diagonal, and the bodies standing in one row along an arm, in
     order, so where the lit one stands says which area it is. The orbit
     spacing, the slant and the diagonal are that page's own numbers. A
     conditional area is a ring, as in that page's key. */
  var W = 340, H = 124, CX = 46, CY = 99, R = 246, SQ = 0.5, ROLL = -0.46, ARM = 0.26;
  function f(v) { return (Math.round(v * 100) / 100).toString(); }
  function draw(n) {
    var N = AREAS.length, at = PLACE[n], cr = Math.cos(ROLL), sr = Math.sin(ROLL);
    var turn = ' transform="rotate(' + f(ROLL * 180 / Math.PI) + ' ' + CX + ' ' + CY + ')"';
    function rr(i) { return N > 1 ? 0.30 + (i / (N - 1)) * 0.70 : 0.65; }
    function pt(rad, th, sq) {
      var x = rad * Math.cos(th), y = rad * sq * Math.sin(th);
      return [CX + x * cr - y * sr, CY + x * sr + y * cr];
    }
    var s = [], i, p;
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="presentation" focusable="false">');
    s.push('<defs>' +
      '<radialGradient id="ak-glow" cx="' + CX + '" cy="' + CY + '" r="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E6DB4" stop-opacity="0.40"/><stop offset="0.45" stop-color="#1B4A86" stop-opacity="0.15"/><stop offset="1" stop-color="#050E1C" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ak-sun" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stop-color="#3F78BE"/><stop offset="0.55" stop-color="#143A6E"/><stop offset="1" stop-color="#071A36"/></radialGradient>' +
      '<radialGradient id="ak-halo"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.80"/><stop offset="0.32" stop-color="#B9D2F4" stop-opacity="0.34"/><stop offset="1" stop-color="#7FA8E0" stop-opacity="0"/></radialGradient>' +
      '</defs>');
    s.push('<rect width="' + W + '" height="' + H + '" fill="#050E1C"/><rect width="' + W + '" height="' + H + '" fill="url(#ak-glow)"/>');
    /* The same few stars behind every card: it is one sky. */
    var seed = 20261121;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    var armX = Math.cos(ARM) * cr - SQ * Math.sin(ARM) * sr, armY = Math.cos(ARM) * sr + SQ * Math.sin(ARM) * cr;
    for (i = 0; i < 26; i++) {
      var sx = rnd() * W, sy = rnd() * H, big = rnd() < 0.18, dim = 0.22 + rnd() * 0.30;
      /* None beside the row, where a star would read as a body. */
      if (Math.abs((sx - CX) * armY - (sy - CY) * armX) / Math.sqrt(armX * armX + armY * armY) < 10) continue;
      s.push('<circle cx="' + f(sx) + '" cy="' + f(sy) + '" r="' + (big ? '0.9' : '0.55') + '" fill="#D6E2F2" fill-opacity="' + f(big ? 0.75 : dim) + '"/>');
    }
    for (i = 0; i < N; i++) {
      var rx = rr(i) * R, lit = i === at;
      if (lit) s.push('<ellipse cx="' + CX + '" cy="' + CY + '" rx="' + f(rx) + '" ry="' + f(rx * SQ) + '"' + turn + ' fill="none" stroke="#DCB34B" stroke-opacity="0.20" stroke-width="3.2"/>');
      s.push('<ellipse cx="' + CX + '" cy="' + CY + '" rx="' + f(rx) + '" ry="' + f(rx * SQ) + '"' + turn + ' fill="none" stroke="' + (lit ? '#DCB34B' : '#AAC4EC') + '" stroke-opacity="' + (lit ? '0.95' : '0.22') + '" stroke-width="' + (lit ? '1.1' : '0.6') + '"/>');
    }
    /* The mark: the sphere and its gold ring, the ring behind it and in front. */
    var a0 = pt(20, 0, SQ), a1 = pt(20, Math.PI, SQ);
    s.push('<ellipse cx="' + CX + '" cy="' + CY + '" rx="20" ry="' + f(20 * SQ) + '"' + turn + ' fill="none" stroke="#DCB34B" stroke-opacity="0.55" stroke-width="1.5"/>');
    s.push('<circle cx="' + CX + '" cy="' + CY + '" r="11.5" fill="url(#ak-sun)" stroke="#D6E2F2" stroke-opacity="0.32" stroke-width="0.6"/>');
    s.push('<path d="M' + f(a0[0]) + ' ' + f(a0[1]) + ' A20 ' + f(20 * SQ) + ' ' + f(ROLL * 180 / Math.PI) + ' 0 1 ' + f(a1[0]) + ' ' + f(a1[1]) + '" fill="none" stroke="#DCB34B" stroke-width="1.5" stroke-linecap="round"/>');
    for (i = 0; i < N; i++) {
      if (i === at) continue;
      p = pt(rr(i) * R, ARM, SQ);
      s.push(AREAS[i].conditional
        ? '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="2.3" fill="#050E1C" stroke="#D6E2F2" stroke-opacity="0.62" stroke-width="0.8"/>'
        : '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="2" fill="#D6E2F2" fill-opacity="0.62"/>');
    }
    p = pt(rr(at) * R, ARM, SQ);
    s.push('<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="11" fill="url(#ak-halo)"/>');
    s.push(AREAS[at].conditional
      ? '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="3.5" fill="#050E1C" stroke="#FFFFFF" stroke-width="1.4"/>'
      : '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="3.5" fill="#FFFFFF"/>');
    s.push('</svg>');
    return s.join('');
  }

  /* FINDING THE NAMES. Text only, and only where a link may stand. */
  var SKIP = 'a, button, summary, label, select, textarea, input, option, script, style, noscript, svg, code, pre, h1, h2, h3, h4, h5, h6, .global-nav, footer, [aria-live], [contenteditable], [data-area-key="off"], .ak-card';
  function wrap(node) {
    var text = node.nodeValue, re = /AI-(\d{1,2})/g, m, last = 0, made = [], frag = null;
    while ((m = re.exec(text))) {
      var end = m.index + m[0].length;
      if (!BY[+m[1]]) continue;
      if (m.index > 0 && /[A-Za-z0-9._\/#-]/.test(text.charAt(m.index - 1))) continue;
      if (/[A-Za-z0-9]/.test(text.charAt(end))) continue;
      if (/[.\-]/.test(text.charAt(end)) && /[0-9]/.test(text.charAt(end + 1))) continue;
      if (!frag) frag = document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      a.className = 'ak-t';
      a.href = '/requirements#ai-' + (+m[1]);
      a.setAttribute('data-ak', +m[1]);
      a.textContent = m[0];
      frag.appendChild(a);
      made.push(a);
      last = end;
    }
    if (!frag) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
    made.forEach(function (a) {
      var p = a.parentNode;
      if (p && p.childNodes.length === 1 && !/^(B|STRONG|EM|I|P|LI|TD|DD)$/.test(p.nodeName)) a.classList.add('ak-tag');
    });
  }
  function scan() {
    var root = document.querySelector('main') || document.body;
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, found = [];
    while ((n = walk.nextNode())) {
      if (n.nodeValue.indexOf('AI-') === -1) continue;
      if (!n.parentElement || n.parentElement.closest(SKIP)) continue;
      found.push(n);
    }
    found.forEach(wrap);
    /* A link the page already has to an area's requirements, standing as the
       area's name, gains the card and keeps its look. */
    [].forEach.call(root.querySelectorAll('a[href]:not(.ak-t)'), function (a) {
      var m = /(?:^|\/)requirements(?:\.html)?#ai-(\d{1,2})$/.exec(a.getAttribute('href') || '');
      if (!m || !BY[+m[1]] || a.textContent.replace(/\s+/g, '') !== 'AI-' + (+m[1])) return;
      if (a.closest('.global-nav, footer, [data-area-key="off"]')) return;
      a.setAttribute('data-ak', +m[1]);
    });
  }

  /* THE CARD. One for the page, made the first time it is wanted. */
  var card = null, sky, idEl, scopeEl, nameEl, lineEl, toReq, toFw;
  var cur = null, openT = 0, closeT = 0, hideT = 0, lastPointer = 'mouse', mute = false;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function build() {
    card = el('div', 'ak-card');
    card.id = 'ak-card';
    card.setAttribute('role', 'group');
    card.hidden = true;
    sky = el('div', 'ak-sky');
    sky.setAttribute('aria-hidden', 'true');
    var words = el('div', 'ak-words');
    words.id = 'ak-words';
    var idRow = el('div', 'ak-id');
    idEl = el('span');
    scopeEl = el('span', 'ak-scope', 'Conditional');
    idRow.appendChild(idEl);
    idRow.appendChild(scopeEl);
    nameEl = el('div', 'ak-name');
    lineEl = el('p', 'ak-line');
    words.appendChild(idRow);
    words.appendChild(nameEl);
    words.appendChild(el('div', 'ak-label', 'The failure it prevents'));
    words.appendChild(lineEl);
    var go = el('div', 'ak-go');
    toReq = el('a', '', 'Requirements');
    toFw = el('a', '', 'Framework');
    go.appendChild(toReq);
    go.appendChild(toFw);
    card.appendChild(sky);
    card.appendChild(words);
    card.appendChild(go);
    document.body.appendChild(card);
  }
  function navFoot() {
    var nav = document.querySelector('.global-nav');
    if (!nav) return 0;
    var r = nav.getBoundingClientRect();
    return r.bottom > 0 && r.top <= 0 ? r.bottom : 0;
  }
  /* Under the name when there is room, over it when there is more room there,
     and never off either side. Placed on the page, so it travels with the
     text when the page is scrolled. */
  function place(t) {
    var r = t.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var cw = card.offsetWidth, ch = card.offsetHeight, GAP = 10, EDGE = 12;
    var x = Math.max(EDGE, Math.min(r.left + r.width / 2 - cw / 2, vw - cw - EDGE));
    var below = vh - r.bottom - GAP - EDGE, above = r.top - navFoot() - GAP - EDGE;
    var up = ch > below && above > below;
    card.style.left = Math.round(x + (window.pageXOffset || 0)) + 'px';
    card.style.top = Math.round((up ? r.top - GAP - ch : r.bottom + GAP) + (window.pageYOffset || 0)) + 'px';
    card.classList.toggle('is-up', up);
  }
  /* While it is open the card keeps to its name. A page that is still
     settling, its type arriving or a block easing into place, moves the name
     under it; scrolling does not, since both are on the page. */
  var followT = 0, atX = 0, atY = 0;
  function spot(t) {
    var r = t.getBoundingClientRect();
    return [Math.round(r.left + (window.pageXOffset || 0)), Math.round(r.top + (window.pageYOffset || 0))];
  }
  function follow() {
    if (!cur) return;
    if (!cur.getClientRects().length) { close(true); return; }
    var s = spot(cur);
    if (s[0] !== atX || s[1] !== atY) { atX = s[0]; atY = s[1]; place(cur); }
    followT = requestAnimationFrame(follow);
  }
  function open(t) {
    var a = BY[+t.getAttribute('data-ak')];
    if (!a) return;
    if (!card) build();
    clearTimeout(openT); clearTimeout(closeT); clearTimeout(hideT);
    var fresh = !cur;
    if (cur && cur !== t) { cur.classList.remove('is-on'); cur.removeAttribute('aria-describedby'); }
    sky.innerHTML = draw(a.n);
    idEl.textContent = 'AI-' + a.n;
    scopeEl.hidden = !a.conditional;
    nameEl.textContent = a.label;
    lineEl.textContent = a.prevents;
    toReq.href = '/requirements#ai-' + a.n;
    toFw.href = '/framework#ai-' + a.n;
    card.setAttribute('aria-label', 'AI-' + a.n + ', ' + a.label);
    card.hidden = false;
    place(t);
    if (fresh) { card.classList.remove('is-open'); void card.offsetWidth; }
    card.classList.add('is-open');
    cur = t;
    t.classList.add('is-on');
    t.setAttribute('aria-describedby', 'ak-words');
    var s = spot(t);
    atX = s[0]; atY = s[1];
    cancelAnimationFrame(followT);
    followT = requestAnimationFrame(follow);
  }
  function close(now) {
    clearTimeout(openT); clearTimeout(closeT);
    cancelAnimationFrame(followT);
    if (!cur) return;
    cur.classList.remove('is-on');
    cur.removeAttribute('aria-describedby');
    cur = null;
    card.classList.remove('is-open');
    clearTimeout(hideT);
    if (now) card.hidden = true;
    else hideT = setTimeout(function () { card.hidden = true; }, 170);
  }
  function name(node) { return node && node.closest ? node.closest('a[data-ak]') : null; }
  function inCard(node) { return !!(card && node && card.contains(node)); }

  /* The pointer. A short wait before opening, so a pointer crossing a
     paragraph raises nothing, and a short wait before closing, so it can
     cross the gap onto the card. */
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var t = name(e.target);
    if (t) {
      clearTimeout(closeT);
      if (t !== cur) { clearTimeout(openT); openT = setTimeout(function () { open(t); }, cur ? 70 : 140); }
    } else if (inCard(e.target)) {
      clearTimeout(closeT);
    }
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType !== 'mouse') return;
    var t = name(e.target);
    if (!t && !inCard(e.target)) return;
    var to = e.relatedTarget;
    if (to && ((cur && name(to) === cur) || inCard(to))) return;
    clearTimeout(openT);
    if (cur) { clearTimeout(closeT); closeT = setTimeout(function () { close(); }, 220); }
  });
  /* A press anywhere else puts the card away. */
  document.addEventListener('pointerdown', function (e) {
    lastPointer = e.pointerType || 'mouse';
    if (cur && !inCard(e.target) && name(e.target) !== cur) close(true);
  }, true);
  /* Touch has no resting pointer: the first tap on a name opens its card and
     the second follows the link, as the framework page's own bodies do. */
  document.addEventListener('click', function (e) {
    var t = name(e.target);
    if (!t || e.detail === 0 || lastPointer === 'mouse' || cur === t) return;
    e.preventDefault();
    open(t);
  });

  /* The keyboard. Reaching a name opens its card; Tab then goes into the
     card and out again to whatever follows the name on the page; Escape puts
     the card away. */
  function seen(t) { try { return t.matches(':focus-visible'); } catch (x) { return true; } }
  function after(t) {
    var all = document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]');
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (!(t.compareDocumentPosition(c) & 4) || inCard(c)) continue;
      if (c.disabled || c.tabIndex < 0 || c.type === 'hidden' || c.closest('[inert], [hidden]')) continue;
      if (!c.getClientRects().length) continue;
      return c;
    }
    return null;
  }
  document.addEventListener('focusin', function (e) {
    var t = name(e.target);
    if (t) { if (!mute && t !== cur && seen(t)) open(t); else clearTimeout(closeT); }
    else if (inCard(e.target)) clearTimeout(closeT);
  });
  document.addEventListener('focusout', function (e) {
    if (!cur || (e.target !== cur && !inCard(e.target))) return;
    var to = e.relatedTarget;
    if (to && (to === cur || inCard(to))) return;
    clearTimeout(closeT);
    closeT = setTimeout(function () { close(); }, 120);
  });
  document.addEventListener('keydown', function (e) {
    if (!cur) return;
    var at = document.activeElement, t = cur;
    if (e.key === 'Escape' || e.key === 'Esc') {
      var back = inCard(at);
      close(true);
      if (back) { mute = true; t.focus(); mute = false; }
      return;
    }
    if (e.key !== 'Tab') return;
    if (!e.shiftKey && at === t) { e.preventDefault(); toReq.focus(); }
    else if (e.shiftKey && at === toReq) { e.preventDefault(); t.focus(); }
    else if (!e.shiftKey && at === toFw) {
      var next = after(t);
      if (!next) return;
      e.preventDefault();
      close(true);
      next.focus();
    }
  });
  window.addEventListener('resize', function () { close(true); });
  window.addEventListener('pagehide', function () { close(true); });

  var style = document.createElement('style');
  style.setAttribute('data-area-key', '');
  style.textContent = CSS;
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
