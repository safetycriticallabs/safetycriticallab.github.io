/* Footer behavior: the privacy choices dialog at the end of this file, and
   nothing else. The phone accordion was removed 2026-07-17 in favor
   of the always-open two-column layout (the ≤900px grid in styles.css now
   carries down to phones). Every page with a footer includes this file. */

/* Hero cursor glow — shared driver for the support pages' .inner-hero
   radial highlight (promoted 2026-08-24 from per-page copies). No-op on
   pages without the glow markup. */
(function () {
  var glow = document.querySelector('.fw-hero-glow');
  var hero = document.querySelector('.inner-hero');
  if (!glow || !hero) return;
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    glow.style.setProperty('--glow-x', (e.clientX - rect.left) + 'px');
    glow.style.setProperty('--glow-y', (e.clientY - rect.top) + 'px');
  });
})();

/* YOUR PRIVACY CHOICES (2026-11-21). The link beside the copyright opens a
   dialog that says what the Site keeps in a visitor's browser and offers the
   one choice there is. With scripts off, or with no dialog element, the link
   goes to /privacy as written.

   THE WORDS FOLLOW /privacy AND THE CODE. The Site sets no analytics or
   marketing cookies, so those two rows are shown off and locked, in that
   page's own words, and are not switches. The first row lists every key the
   Site's own pages write: scl-ask-thread and scl-ask-consent (search.html),
   sclNewsCache.v2 (news.html), sclRegNews.v1 and scl-vt-alone (index.html,
   framework.html), and scl_subscriptions (subscribe.html). A page that starts
   or stops keeping something changes that row in the same commit.

   THE ONE SWITCH IS THE ASK PAGE'S OWN. It reads and writes scl-ask-consent
   exactly as the retention box in search.html does, "1" for on and absent
   for off, so the two cannot disagree, and the Worker is asked to keep a
   question only when that key says so. The sentence beside it is that box's
   own consent statement. */
(function () {
  var link = document.querySelector('.footer-choices');
  if (!link || !window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;
  var KEY = 'scl-ask-consent';
  var dlg = null, box = null, title = null;
  function kept() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function keep(on) {
    try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {}
    return kept();
  }
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'pc-dialog';
    dlg.id = 'pc-dialog';
    dlg.setAttribute('aria-labelledby', 'pc-title');
    dlg.innerHTML =
      '<div class="pc-inner">' +
        '<h2 class="pc-title" id="pc-title" tabindex="-1">Your privacy choices</h2>' +
        '<p class="pc-intro">What the Site keeps in your browser, and the one choice that is yours. You can change it at any time. <a href="/privacy">Learn more</a></p>' +
        '<label class="pc-row"><input type="checkbox" checked disabled>' +
          '<span class="pc-name">Strictly necessary</span>' +
          '<span class="pc-desc">Kept in your browser so the Site works: your Ask SCL conversation while its tab is open, your choice below, saved copies of the regulatory feeds, and a marker that lasts a moment while the home page opens into the framework page. The subscribe page also keeps a note of the address you entered. These cannot be turned off.</span></label>' +
        '<label class="pc-row"><input type="checkbox" id="pc-ask">' +
          '<span class="pc-name">Ask SCL question retention</span>' +
          '<span class="pc-desc">Let SCL keep my Ask SCL questions to improve the assistant. Stored without identifiers; attached documents are never kept. Retained questions are deleted after 12 months. <a href="/privacy#ask">How this works</a></span></label>' +
        '<label class="pc-row"><input type="checkbox" disabled>' +
          '<span class="pc-name">Analytics <span class="pc-tag">Not used</span></span>' +
          '<span class="pc-desc">We do not run third-party analytics on the Site and do not track page-by-page browsing.</span></label>' +
        '<label class="pc-row"><input type="checkbox" disabled>' +
          '<span class="pc-name">Marketing <span class="pc-tag">Not used</span></span>' +
          '<span class="pc-desc">We do not set marketing or advertising cookies, build advertising profiles, or sell visitor data.</span></label>' +
        '<div class="pc-foot"><button type="button" class="pc-done">Done</button></div>' +
      '</div>';
    document.body.appendChild(dlg);
    box = dlg.querySelector('#pc-ask');
    title = dlg.querySelector('.pc-title');
    box.addEventListener('change', function () {
      box.checked = keep(box.checked);
      /* On the Ask page itself, its own box shows the same setting. */
      var own = document.getElementById('ask-consent-box');
      if (own) own.checked = box.checked;
    });
    dlg.querySelector('.pc-done').addEventListener('click', function () { dlg.close(); });
    /* A press on the dimmed page, outside the card, closes it too. */
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('pc-open'); });
  }
  link.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!dlg) build();
    box.checked = kept();
    document.documentElement.classList.add('pc-open');
    dlg.showModal();
    title.focus();
  });
})();
