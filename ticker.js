/* ─── CREDIBILITY TICKER ─────────────────────────────────────
   Pulls recent AI regulatory activity from Federal Register,
   EUR-Lex (EU AI Act), and NIST, and renders a scrolling
   ticker bar. Caches results in sessionStorage for instant
   rendering on subsequent page navigations.
   ──────────────────────────────────────────────────────────── */
(function () {
  var CORS_PROXY = 'https://scl-cors-proxy.kevwill94.workers.dev/?url=';
  var CACHE_KEY = 'scl_ticker_cache';
  var CACHE_MAX_AGE = 10 * 60 * 1000; /* 10 minutes */

  var LOGOS = {
    us: '<img src="img/federal-register.svg" alt="Federal Register" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">',
    eu: '<img src="img/eu-flag.svg" alt="EU" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">',
    nist: '<img src="img/nist.svg" alt="NIST" style="height:100%;object-fit:contain;">'
  };

  var logoMap = { 'Federal Register': LOGOS.us, 'EU': LOGOS.eu, 'NIST': LOGOS.nist };

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTicker(items) {
    var track = document.getElementById('reg-ticker-track');
    if (!track || items.length === 0) return;

    items.sort(function (a, b) { return (b.sortDate || 0) - (a.sortDate || 0); });

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var logo = logoMap[item.source] || '';
      html += '<a class="reg-ticker-item" href="' + item.url + '" target="_blank" rel="noopener" draggable="false">'
        + '<span class="reg-ticker-icon">' + logo + '</span>'
        + '<span class="reg-ticker-source">' + item.source + '</span>'
        + '<span class="reg-ticker-text">' + item.title + '</span>'
        + '<span class="reg-ticker-date">' + item.date + '</span>'
        + '</a><span class="reg-ticker-sep"></span>';
    }
    track.innerHTML = html + html;
    /* Set speed based on content width: consistent 50px/s */
    track.classList.remove('scrolling');
    void track.offsetWidth;
    var halfWidth = track.scrollWidth / 2;
    var duration = halfWidth / 50;
    track.style.animationDuration = duration + 's';
    track.classList.add('scrolling');
  }

  /* ── Try loading from sessionStorage for instant render ── */
  var cached = null;
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      cached = JSON.parse(raw);
      if (Date.now() - cached.ts < CACHE_MAX_AGE) {
        renderTicker(cached.items);
      } else {
        cached = null;
      }
    }
  } catch (e) { cached = null; }

  /* ── Fetch fresh data ──────────────────────────────────── */
  var tickerItems = [];
  var tickerSources = { us: false, eu: false, nist: false };
  var cacheWasUsed = !!cached;

  function tryFinalize() {
    if (!tickerSources.us || !tickerSources.eu || !tickerSources.nist) return;
    /* Only re-render if cache wasn't already shown — avoids animation restart */
    if (!cacheWasUsed) {
      renderTicker(tickerItems);
    }
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: tickerItems }));
    } catch (e) { /* storage full or unavailable */ }
  }

  /* ── US Federal Register ───────────────────────────── */
  var frAiKeywords = /artificial intelligence|AI safety|AI system|AI risk|machine learning|algorithmic|autonomous|neural network|AI governance|AI regulation/i;

  fetch('https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=%22artificial+intelligence%22&order=newest&per_page=100&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=type')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var filtered = [];
      for (var i = 0; i < data.results.length && filtered.length < 3; i++) {
        if (frAiKeywords.test(data.results[i].title)) filtered.push(data.results[i]);
      }
      filtered.forEach(function (doc) {
        tickerItems.push({
          title: escapeHtml(doc.title), url: doc.html_url,
          date: formatDate(doc.publication_date), source: 'Federal Register',
          sortDate: new Date(doc.publication_date).getTime()
        });
      });
      tickerSources.us = true; tryFinalize();
    })
    .catch(function () { tickerSources.us = true; tryFinalize(); });

  /* ── EUR-Lex (EU AI Act) ───────────────────────────── */
  var euAiFallback = [
    { title: 'Proposal amending Regulation (EU) 2024/1689 — Digital Omnibus on AI', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025PC0836', date: formatDate('2025-11-19') },
    { title: 'European Strategy for Artificial Intelligence — Communication from the Commission', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025DC0724', date: formatDate('2025-10-08') },
    { title: 'Commission Implementing Regulation (EU) 2025/454 — Rules for the application of the AI Act', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025R0454', date: formatDate('2025-03-07') }
  ];

  var euAiKeywords = /artificial intelligence|AI Act|2024\/1689|high-risk AI|AI system|AI regulation|machine learning|algorithmic|AI agent|2025\/454/i;

  fetch(CORS_PROXY + encodeURIComponent('https://eur-lex.europa.eu/EN/display-feed.rss?rssId=162'))
    .then(function (r) { return r.text(); })
    .then(function (xml) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xml, 'text/xml');
      var rssItems = doc.querySelectorAll('item');
      var filtered = [];
      for (var i = 0; i < rssItems.length && filtered.length < 3; i++) {
        var title = rssItems[i].querySelector('title') ? rssItems[i].querySelector('title').textContent : '';
        var desc = rssItems[i].querySelector('description') ? rssItems[i].querySelector('description').textContent : '';
        if (euAiKeywords.test(title) || euAiKeywords.test(desc)) {
          var link = rssItems[i].querySelector('link') ? rssItems[i].querySelector('link').textContent : '';
          var pubDate = rssItems[i].querySelector('pubDate') ? rssItems[i].querySelector('pubDate').textContent : '';
          var cleanTitle = title.replace(/^CELEX:\S+:\s*/, '').replace(/^CELEX:\S+\s*/, '');
          if (!cleanTitle || cleanTitle.length < 5) cleanTitle = title;
          filtered.push({ title: escapeHtml(cleanTitle), url: link, date: pubDate ? formatDate(pubDate) : '' });
        }
      }
      var euItems = filtered.length > 0 ? filtered : euAiFallback;
      euItems.forEach(function (item) {
        tickerItems.push({ title: item.title, url: item.url, date: item.date, source: 'EU', sortDate: new Date(item.date).getTime() });
      });
      tickerSources.eu = true; tryFinalize();
    })
    .catch(function () {
      euAiFallback.forEach(function (item) {
        tickerItems.push({ title: item.title, url: item.url, date: item.date, source: 'EU', sortDate: new Date(item.date).getTime() });
      });
      tickerSources.eu = true; tryFinalize();
    });

  /* ── NIST (News + Drafts) ──────────────────────────── */
  var nistAiKeywords = /artificial intelligence|AI |AI-|machine learning|cybersecurity framework|risk management framework|AI agent|agentic|neural network/i;

  Promise.all([
    fetch(CORS_PROXY + encodeURIComponent('https://www.nist.gov/news-events/news/rss.xml')).then(function (r) { return r.text(); }).catch(function () { return ''; }),
    fetch(CORS_PROXY + encodeURIComponent('https://csrc.nist.gov/CSRC/media/feeds/pubs/drafts-open-for-comment.json')).then(function (r) { return r.text(); }).catch(function () { return ''; })
  ]).then(function (results) {
    var nistItems = [];

    if (results[0] && results[0].indexOf('<item') !== -1) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(results[0], 'text/xml');
      var rssItems = doc.querySelectorAll('item');
      for (var i = 0; i < rssItems.length && nistItems.length < 4; i++) {
        var title = rssItems[i].querySelector('title') ? rssItems[i].querySelector('title').textContent : '';
        var desc = rssItems[i].querySelector('description') ? rssItems[i].querySelector('description').textContent : '';
        if (nistAiKeywords.test(title) || nistAiKeywords.test(desc)) {
          var link = rssItems[i].querySelector('link') ? rssItems[i].querySelector('link').textContent : '';
          var pubDate = rssItems[i].querySelector('pubDate') ? rssItems[i].querySelector('pubDate').textContent : '';
          nistItems.push({ title: escapeHtml(title), url: link, date: pubDate ? formatDate(pubDate) : '', sortDate: pubDate ? new Date(pubDate).getTime() : 0 });
        }
      }
    }

    if (results[1] && results[1].indexOf('"entries"') !== -1) {
      try {
        var data = JSON.parse(results[1].replace(/^\uFEFF/, ''));
        (data.entries || []).forEach(function (entry) {
          var t = (entry.title || '').replace(/^(SP|IR|FIPS|Other)\s*\[.*?\]\s*/i, '').replace(/Initial Public Draft\s*$/i, '').replace(/Final Public Draft\s*$/i, '').trim();
          nistItems.push({ title: escapeHtml(t), url: entry.link || entry.id || '', date: entry.published ? formatDate(entry.published) : '', sortDate: entry.published ? new Date(entry.published).getTime() : 0 });
        });
      } catch (e) { /* skip */ }
    }

    nistItems.sort(function (a, b) { return b.sortDate - a.sortDate; });
    nistItems.slice(0, 3).forEach(function (item) {
      tickerItems.push({ title: item.title, url: item.url, date: item.date, source: 'NIST', sortDate: item.sortDate });
    });
    tickerSources.nist = true; tryFinalize();
  }).catch(function () { tickerSources.nist = true; tryFinalize(); });

})();
