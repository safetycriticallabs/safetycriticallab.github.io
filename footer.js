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
