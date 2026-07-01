/* Footer accordion — mobile only.
   Section labels become toggle buttons; tapping expands/collapses the link list.
   Desktop: untouched (CSS keeps everything visible). */
(function () {
  var labels = document.querySelectorAll('.footer-col-label');
  if (!labels.length) return;

  labels.forEach(function (label) {
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-expanded', 'false');

    var toggle = function (e) {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      var col = label.closest('.footer-col');
      if (!col) return;
      var open = col.classList.toggle('is-open');
      label.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    label.addEventListener('click', toggle);
    label.addEventListener('keydown', toggle);
  });
})();

/* Holographic "SCL" nav wordmark (mobile only) — a chrome-blue reflection whose
   glint tracks scroll position (foil catching light as the page moves). Driven
   purely by scroll: it holds still at rest, sweeps only while you scroll. Sets
   --scl-shine (a background-position %); CSS does the fill. */
(function () {
  var abbr = document.querySelector('.gn-text-abbr');
  if (!abbr) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; /* static centered glint */

  var mq = window.matchMedia('(max-width: 480px)');
  var ticking = false;

  function apply() {
    ticking = false;
    var sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    /* ≈220px of scroll = one full sweep; sine → smooth, never snaps */
    var glint = 50 + 32 * Math.sin((sc / 220) * 6.2832);
    abbr.style.setProperty('--scl-shine', glint.toFixed(2) + '%');
  }
  function onScroll() {
    if (!mq.matches || ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  var onMq = function () { if (mq.matches) apply(); };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
  if (mq.matches) apply();   /* set the glint for the current scroll position */
})();
