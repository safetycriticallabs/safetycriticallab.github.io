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

/* Metallic "SCL" nav wordmark (mobile only) — a chrome-blue specular glint that
   sweeps across the letters as you scroll, with a slow idle shimmer at rest.
   Sets --scl-shine (a background-position %) each frame; CSS does the rest. */
(function () {
  var abbr = document.querySelector('.gn-text-abbr');
  if (!abbr) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; /* static centered glint */

  var mq = window.matchMedia('(max-width: 480px)');
  var raf = 0, running = false;

  function frame(t) {
    if (!running) return;
    var sc = window.pageYOffset || document.documentElement.scrollTop || 0;
    /* one smooth phase from time (idle) + scroll (sweep); sine never snaps */
    var glint = 50 + 45 * Math.sin(t * 0.0015 + sc * 0.006);
    abbr.style.setProperty('--scl-shine', glint.toFixed(2) + '%');
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  function sync() { (mq.matches && !document.hidden) ? start() : stop(); }

  mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
