/* ─── CREDIBILITY TICKER ─────────────────────────────────────
   Pulls recent AI regulatory activity from Federal Register,
   EUR-Lex (EU AI Act), and NIST, and renders a scrolling
   ticker bar. Include this script on any page with:
   <div class="reg-ticker" id="reg-ticker"><div class="reg-ticker-track" id="reg-ticker-track"></div></div>
   ──────────────────────────────────────────────────────────── */
(function () {
  var CORS_PROXY = 'https://corsproxy.io/?';
  var tickerItems = [];
  var tickerSources = { us: false, eu: false, nist: false };

  /* ── Agency logos (inline SVG) ─────────────────────── */
  var LOGOS = {
    us: '<img src="img/federal-register.svg" alt="Federal Register" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">',
    eu: '<img src="img/eu-flag.svg" alt="EU" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">',
    nist: '<img src="img/nist.svg" alt="NIST" style="width:100%;height:100%;object-fit:contain;filter:invert(1);">'
  };

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function tryBuildTicker() {
    if (!tickerSources.us || !tickerSources.eu || !tickerSources.nist) return;
    var track = document.getElementById('reg-ticker-track');
    if (!track || tickerItems.length === 0) return;

    tickerItems.sort(function (a, b) { return (b.sortDate || 0) - (a.sortDate || 0); });

    var html = '';
    function itemHtml(item) {
      return '<a class="reg-ticker-item" href="' + item.url + '" target="_blank" rel="noopener">'
        + '<span class="reg-ticker-icon">' + item.logo + '</span>'
        + '<span class="reg-ticker-source">' + item.source + '</span>'
        + '<span class="reg-ticker-text">' + item.title + '</span>'
        + '<span class="reg-ticker-date">' + item.date + '</span>'
        + '</a><span class="reg-ticker-sep"></span>';
    }
    for (var i = 0; i < tickerItems.length; i++) html += itemHtml(tickerItems[i]);
    track.innerHTML = html + html;
  }

  /* ── US Federal Register ───────────────────────────── */
  fetch('https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=%22artificial+intelligence%22&order=newest&per_page=3&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=type')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      data.results.slice(0, 3).forEach(function (doc) {
        tickerItems.push({
          title: escapeHtml(doc.title), url: doc.html_url,
          date: formatDate(doc.publication_date), source: 'Federal Register',
          logo: LOGOS.us,
          sortDate: new Date(doc.publication_date).getTime()
        });
      });
      tickerSources.us = true; tryBuildTicker();
    })
    .catch(function () { tickerSources.us = true; tryBuildTicker(); });

  /* ── EUR-Lex (EU AI Act) ───────────────────────────── */
  var euAiFallback = [
    { title: 'Proposal amending Regulation (EU) 2024/1689 — Digital Omnibus on AI', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025PC0836', date: formatDate('2025-11-19'), type: 'Legislative Proposal' },
    { title: 'European Strategy for Artificial Intelligence — Communication from the Commission', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025DC0724', date: formatDate('2025-10-08'), type: 'Commission Communication' },
    { title: 'Commission Implementing Regulation (EU) 2025/454 — Rules for the application of the AI Act', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025R0454', date: formatDate('2025-03-07'), type: 'Implementing Regulation' }
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
        tickerItems.push({
          title: item.title, url: item.url, date: item.date,
          source: 'EU', logo: LOGOS.eu,
          sortDate: new Date(item.date).getTime()
        });
      });
      tickerSources.eu = true; tryBuildTicker();
    })
    .catch(function () {
      euAiFallback.forEach(function (item) {
        tickerItems.push({
          title: item.title, url: item.url, date: item.date,
          source: 'EU', logo: LOGOS.eu,
          sortDate: new Date(item.date).getTime()
        });
      });
      tickerSources.eu = true; tryBuildTicker();
    });

  /* ── NIST (News + Drafts) ──────────────────────────── */
  var nistAiKeywords = /artificial intelligence|AI |AI-|machine learning|cybersecurity framework|risk management framework|AI agent|agentic|neural network/i;

  Promise.all([
    fetch(CORS_PROXY + encodeURIComponent('https://www.nist.gov/news-events/news/rss.xml')).then(function (r) { return r.text(); }).catch(function () { return ''; }),
    fetch(CORS_PROXY + encodeURIComponent('https://csrc.nist.gov/CSRC/media/feeds/pubs/drafts-open-for-comment.json')).then(function (r) { return r.text(); }).catch(function () { return ''; })
  ]).then(function (results) {
    var nistItems = [];

    if (results[0]) {
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

    if (results[1]) {
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
      tickerItems.push({
        title: item.title, url: item.url, date: item.date,
        source: 'NIST', logo: LOGOS.nist,
        sortDate: item.sortDate
      });
    });
    tickerSources.nist = true; tryBuildTicker();
  }).catch(function () { tickerSources.nist = true; tryBuildTicker(); });

})();
