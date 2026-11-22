/* THE READING RAIL (2026-11-21). The requirements page is one long column:
   every requirement area and every requirement, in order. This puts a slim
   rail in the margin beside that column to show where the reader is. Each
   area is a body on a line, as the framework page draws them, and each of its
   requirements a streak, one to a requirement. The area being read is lit and
   the requirement being read is the long streak. A press on a body goes to
   that area and a press on a streak to that requirement; resting on either
   says which it is.

   Everything is read from the page itself: the areas are the .req-area
   sections and the requirements their h3 headings, in the order
   generate_requirements.py wrote them. Nothing here knows how many there
   are, so a new version of the framework needs no change to this file.

   It appears only where there is room: a window wide enough to leave a margin
   beside the column and tall enough to hold every streak, and only while the
   column is beside it. On a phone the page is as it was. The list of areas at
   the top of the page is untouched and remains the way in for a keyboard. */
(function () {
  'use strict';
  var wrap = document.querySelector('.req-wrap');
  var sections = [].slice.call(document.querySelectorAll('.req-area[id]'));
  if (!wrap || !sections.length || !window.requestAnimationFrame || !Element.prototype.closest) return;

  /* The look. Ink on the page's own cream: the line and the streaks are
     faint, the area being read is dark with the gold of a lit orbit down its
     side, and the label that names a streak is a chip of the framework
     page's night. The numbers that place things across the rail (the label's
     edge, the line at 60px, the streaks from 62px) are used only here. */
  var CSS = [
    '.rr{position:fixed;z-index:20;left:0;top:0;width:92px;margin:0;padding:0;opacity:0;visibility:hidden;transition:opacity 0.2s ease,visibility 0s linear 0.2s;font-family:var(--sans,"DM Sans",system-ui,sans-serif);line-height:1;-webkit-user-select:none;user-select:none;}',
    '.rr.is-in{opacity:1;visibility:visible;transition:opacity 0.2s ease;}',
    '.rr-line{position:absolute;left:60px;top:calc(var(--rr-h,18px) / 2);bottom:0;width:1px;background:rgba(12,34,66,0.14);}',
    '.rr-area{position:relative;margin:0 0 var(--rr-b,6px);}',
    '.rr-area:last-of-type{margin-bottom:0;}',
    '.rr-area::before{content:"";position:absolute;left:59.5px;top:calc(var(--rr-h,18px) / 2);bottom:0;width:2px;border-radius:1px;background:#DCB34B;opacity:0;transition:opacity 0.2s ease;}',
    '.rr-area.is-on::before{opacity:1;}',
    '.rr-head{position:relative;display:block;height:var(--rr-h,18px);text-decoration:none;}',
    '.rr-id{position:absolute;right:42px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:500;letter-spacing:0.06em;white-space:nowrap;color:#566C84;transition:color 0.2s ease;}',
    '.rr-body{position:absolute;left:57px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;background:#8E9BAD;box-shadow:0 0 0 2px #FAF9F5;transition:background 0.2s ease,box-shadow 0.2s ease,transform 0.2s ease;}',
    '.rr-tick{position:relative;display:block;height:var(--rr-p,4px);}',
    '.rr-tick i{position:absolute;left:62px;top:50%;width:9px;height:1.5px;margin-top:-0.75px;border-radius:1px;background:rgba(12,34,66,0.22);transition:width 0.15s ease,background 0.15s ease;}',
    '.rr-area.is-on .rr-id{color:#0C2242;font-weight:600;}',
    '.rr-area.is-on .rr-body{background:#0C2242;box-shadow:0 0 0 2px #FAF9F5,0 0 0 3.5px #DCB34B;transform:scale(1.15);}',
    '.rr-area.is-on .rr-tick i{background:rgba(12,34,66,0.5);}',
    '.rr-tick.is-at i{width:18px;height:2px;margin-top:-1px;background:#0C2242;}',
    '.rr-head:hover .rr-id,.rr-head:focus-visible .rr-id{color:#0C2242;}',
    '.rr-head:hover .rr-body{background:#0C2242;}',
    '.rr-tick:hover i{width:18px;background:#2E6DB4;}',
    '.rr-head:focus-visible{outline:2px solid #1E5A9A;outline-offset:1px;border-radius:3px;}',
    '.rr-tip{position:absolute;left:84px;top:0;transform:translateY(-50%);max-width:300px;padding:6px 10px;border-radius:6px;background:#050E1C;color:#FAF9F5;font-size:12.5px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 22px rgba(12,34,66,0.24);pointer-events:none;opacity:0;transition:opacity 0.12s ease;}',
    '.rr-tip.is-in{opacity:1;}',
    '.rr-tip b{margin-right:8px;font-size:11px;font-weight:500;letter-spacing:0.06em;color:rgba(214,226,242,0.84);}',
    '@media (prefers-reduced-motion: reduce){.rr,.rr.is-in,.rr-area::before,.rr-id,.rr-body,.rr-tick i,.rr-tip{transition:none;}}',
    '@media print{.rr{display:none;}}'
  ].join('\n');

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  /* A heading on this page is an identifier and then a title. */
  function words(h) {
    var idEl = h ? h.querySelector('.req-id') : null;
    var id = idEl ? idEl.textContent.replace(/\s+/g, ' ').trim() : '';
    var all = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    return { id: id, title: id && all.indexOf(id) === 0 ? all.slice(id.length).trim() : all };
  }

  /* THE RAIL, built once from the page. A stop is anything the reader can be
     at: the head of an area, then each of its requirements, in page order. */
  var rail = el('nav', 'rr');
  rail.setAttribute('aria-label', 'Requirement areas on this page');
  rail.appendChild(el('span', 'rr-line'));
  var stops = [], groups = [];
  sections.forEach(function (sec, ai) {
    var w = words(sec.querySelector('h2'));
    var group = el('div', 'rr-area'), head = el('a', 'rr-head'), idSpan = el('span', 'rr-id');
    if (!w.id) w.id = sec.id.toUpperCase();
    head.href = '#' + sec.id;
    head.setAttribute('data-i', stops.length);
    if (w.title) head.setAttribute('aria-label', w.id + ' ' + w.title);
    idSpan.textContent = w.id;
    head.appendChild(idSpan);
    head.appendChild(el('i', 'rr-body'));
    group.appendChild(head);
    stops.push({ at: sec, a: head, area: ai, id: w.id, title: w.title });
    [].forEach.call(sec.querySelectorAll('h3[id]'), function (h3) {
      var r = words(h3), t = el('a', 'rr-tick');
      t.href = '#' + h3.id;
      t.setAttribute('data-i', stops.length);
      /* The streaks are for a pointer. A keyboard and a screen reader have
         the headings themselves and the area links, one to a body. */
      t.tabIndex = -1;
      t.setAttribute('aria-hidden', 'true');
      t.appendChild(el('i'));
      group.appendChild(t);
      stops.push({ at: h3, a: t, area: ai, id: r.id, title: r.title });
    });
    groups.push(group);
    rail.appendChild(group);
  });
  var tip = el('span', 'rr-tip'), tipId = el('b'), tipTitle = el('span');
  tip.setAttribute('aria-hidden', 'true');
  tip.appendChild(tipId);
  tip.appendChild(tipTitle);
  rail.appendChild(tip);

  /* WHERE IT STANDS. W is the rail's width and GAP the clear space between
     it and the column. HEAD is the height of an area's row, BETWEEN the space
     under an area, PAD the least space above and below the whole rail. A
     streak takes as much height as the window allows, up to P_MAX. In a
     short window the area rows close up first (TIGHT), and below P_MIN the
     streaks could not be told apart, so the rail stays away. */
  var W = 92, GAP = 26, HEAD = 18, BETWEEN = 6, PAD = 20, P_MAX = 5, P_MIN = 2.5;
  var TIGHT = { below: 3, head: 14, between: 3 };
  var navFoot = 72, fits = false, top = 0, height = 0;
  function layout() {
    var nav = document.querySelector('.global-nav');
    var r = wrap.getBoundingClientRect(), vh = window.innerHeight;
    navFoot = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
    var nA = sections.length, nR = stops.length - nA;
    var avail = vh - navFoot - PAD * 2, head = HEAD, between = BETWEEN;
    function pitch() { return nR ? Math.min(P_MAX, (avail - nA * head - (nA - 1) * between) / nR) : P_MAX; }
    var p = pitch();
    if (p < TIGHT.below) { head = TIGHT.head; between = TIGHT.between; p = pitch(); }
    fits = r.left >= W + GAP + 8 && p >= P_MIN;
    if (!fits) { shown = false; rail.classList.remove('is-in'); hideTip(); return; }
    p = Math.floor(p * 2) / 2;
    height = nA * head + (nA - 1) * between + nR * p;
    top = Math.round(navFoot + PAD + (avail - height) / 2);
    rail.style.setProperty('--rr-p', p + 'px');
    rail.style.setProperty('--rr-h', head + 'px');
    rail.style.setProperty('--rr-b', between + 'px');
    rail.style.left = Math.round(r.left - GAP - W) + 'px';
    rail.style.top = top + 'px';
  }

  /* WHERE THE READER IS. The stop being read is the last one whose top has
     come above a line three tenths of the way down the window. The rail is
     shown from when the column's top has reached the rail's top until the
     footer comes up to its foot, so it is never over the page's opening or
     over the footer. */
  var foot = document.querySelector('.site-footer');
  var cur = -1, curArea = -1, shown = false, queued = false;
  function track() {
    queued = false;
    if (!fits) return;
    var mark = navFoot + (window.innerHeight - navFoot) * 0.3;
    var lo = 0, hi = stops.length - 1, at = -1, mid;
    while (lo <= hi) {
      mid = (lo + hi) >> 1;
      if (stops[mid].at.getBoundingClientRect().top <= mark) { at = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    var r = wrap.getBoundingClientRect();
    var end = foot ? foot.getBoundingClientRect().top - 16 : r.bottom;
    var show = r.top <= top && end >= top + height;
    if (show !== shown) {
      shown = show;
      rail.classList.toggle('is-in', show);
      if (!show) hideTip();
    }
    if (at === cur) return;
    if (cur >= 0) stops[cur].a.classList.remove('is-at');
    if (at >= 0) stops[at].a.classList.add('is-at');
    cur = at;
    var area = at >= 0 ? stops[at].area : -1;
    if (area === curArea) return;
    if (curArea >= 0) { groups[curArea].classList.remove('is-on'); groups[curArea].firstChild.removeAttribute('aria-current'); }
    if (area >= 0) { groups[area].classList.add('is-on'); groups[area].firstChild.setAttribute('aria-current', 'true'); }
    curArea = area;
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(track);
  }

  /* WHICH ONE THIS IS. Resting on a body or a streak, or reaching a body with
     the keyboard, names it beside the rail. */
  function showTip(a) {
    var s = stops[+a.getAttribute('data-i')];
    if (!s) return;
    tipId.textContent = s.id;
    tipTitle.textContent = s.title;
    var ar = a.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    tip.style.top = Math.round(ar.top - rr.top + ar.height / 2) + 'px';
    tip.classList.add('is-in');
  }
  function hideTip() { tip.classList.remove('is-in'); }
  function link(node) {
    var a = node && node.closest ? node.closest('a') : null;
    return a && rail.contains(a) ? a : null;
  }
  rail.addEventListener('pointerover', function (e) { var a = link(e.target); if (a) showTip(a); else hideTip(); });
  rail.addEventListener('pointerleave', hideTip);
  rail.addEventListener('focusin', function (e) { var a = link(e.target); if (a) showTip(a); });
  rail.addEventListener('focusout', hideTip);

  var style = document.createElement('style');
  style.setAttribute('data-req-rail', '');
  style.textContent = CSS;
  document.head.appendChild(style);
  (document.getElementById('main') || document.body).appendChild(rail);
  function settle() { layout(); track(); }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', settle);
  window.addEventListener('load', settle);
  settle();
})();
