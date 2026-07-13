/* Footer accordion — mobile only.
   Group labels become toggle buttons; tapping expands/collapses that group's
   link list. Toggles .is-open on the .footer-col-group (each label owns its
   own group, so Company and Briefings collapse independently even though they
   share a .footer-col). Button semantics are only attached at phone widths so
   desktop screen readers don't hear inert "buttons"; CSS keeps everything
   visible on desktop regardless. */
(function () {
  var labels = document.querySelectorAll('.footer-col-label');
  if (!labels.length) return;

  var mq = window.matchMedia('(max-width: 560px)');

  var toggle = function (e) {
    if (!mq.matches) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    var group = e.currentTarget.closest('.footer-col-group');
    if (!group) return;
    var open = group.classList.toggle('is-open');
    e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  var applyMode = function () {
    labels.forEach(function (label) {
      if (mq.matches) {
        label.setAttribute('role', 'button');
        label.setAttribute('tabindex', '0');
        var group = label.closest('.footer-col-group');
        label.setAttribute('aria-expanded',
          group && group.classList.contains('is-open') ? 'true' : 'false');
      } else {
        label.removeAttribute('role');
        label.removeAttribute('tabindex');
        label.removeAttribute('aria-expanded');
      }
    });
  };

  labels.forEach(function (label) {
    label.addEventListener('click', toggle);
    label.addEventListener('keydown', toggle);
  });

  if (mq.addEventListener) mq.addEventListener('change', applyMode);
  else if (mq.addListener) mq.addListener(applyMode);
  applyMode();
})();
