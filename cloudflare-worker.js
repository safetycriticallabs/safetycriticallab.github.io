/**
 * SCL CORS Proxy — Cloudflare Worker
 * ------------------------------------
 * Acts as a CORS-friendly relay for the public regulatory feeds
 * the site already pulls (EUR-Lex, NIST). Replaces the unreliable
 * public proxies (corsproxy.io, api.cors.lol).
 *
 * Deploy: dashboard.cloudflare.com → Workers & Pages → Create → Worker
 * Paste this whole file as the Worker code and click Deploy.
 * The deployed worker the site uses is:
 *   https://scl-cors-proxy.kevwill94.workers.dev
 * `CORS_PROXY` in index.html and news.html points to:
 *   const CORS_PROXY = 'https://scl-cors-proxy.kevwill94.workers.dev/?url=';
 * Edits to this file take effect only after a manual redeploy.
 *
 * Free tier: 100,000 requests/day. Your traffic is well below this.
 */

// Domains this proxy will fetch from. Anything else is rejected so
// the worker can't be abused as a general open proxy.
//
// SELECTION RULE, published at /impartiality section 10. Two tests, and a host
// must pass both to belong here. SOURCE: the publisher sells no AI product or
// service, which keeps SCL out of its own prospect universe. PURPOSE: what it
// publishes bears on safety, transparency, or innovation that changes what an
// assessment has to demonstrate. No commercial AI vendor host belongs on this
// list, and no general AI press host either.
//
// This list is the control behind the rule, not a restatement of it. Adding a
// source to FEEDS in news.html does nothing unless its host is added here and
// the worker is redeployed, so restoring vendor content is a deliberate
// infrastructure change rather than a one line edit inside a page. Anything
// added here is added to the published list on /impartiality the same day.
//
// REMOVED 2026-09-11, when /news became a regulatory and standards register:
// hai.stanford.edu, news.mit.edu, research.google, www.alignmentforum.org,
// openai.com, deepmind.google, techcrunch.com, feeds.arstechnica.com and
// news.google.com. The last of those carried a hand written seven company
// search query, which is the specific thing that made SCL the editor of which
// AI firms appeared on its own site.
//
// news.mit.edu and www.allenai.org were restored on the same day under the
// widened source test. Neither sells an AI product, so neither can become an
// SCL client, and the purpose gate in news.html drops the institutional notices
// their feeds also carry. hai.stanford.edu was NOT restored: it serves no RSS
// and is reachable only through news.google.com, and readmitting that host
// would restore the capability to run an arbitrary company search, which is the
// capability that caused the problem. Revisit only as a deliberate trade.
const ALLOWED_HOSTS = [
  // Regulators and standards bodies
  'eur-lex.europa.eu',
  'www.federalregister.gov',
  'www.nist.gov',
  'csrc.nist.gov',
  // Research institutions that sell no AI product or service
  'news.mit.edu',
  // Apex domain, NOT www. www.allenai.org 301s to http://allenai.org, and the
  // redirect check below requires https, so the www form is rejected as a
  // disallowed redirect target even when it is on this list. Use the apex.
  'allenai.org',
];

// CHANGED (requires manual redeploy): origin allowlist replaces the single
// hardcoded origin, so www, github.io, and localhost dev all work.
// Origins allowed to call this worker. The request Origin is echoed back
// only when it matches. Any http://localhost origin (any port) is also
// allowed for local development.
const ALLOWED_ORIGINS = [
  'https://safetycriticallabs.com',
  'https://www.safetycriticallabs.com',
  'https://safetycriticallabs.github.io',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const o = new URL(origin);
    return o.protocol === 'http:' && o.hostname === 'localhost';
  } catch {
    return false;
  }
}

// Build per-request CORS headers. 'Vary: Origin' is set so the edge cache
// never serves one origin's Access-Control-Allow-Origin header to another.
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: cors });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: cors });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: cors });
    }

    try {
      // CHANGED (requires manual redeploy): redirects are followed manually
      // so a 3xx from an allowed host cannot relay the request to a
      // non-allowlisted destination. Each hop is re-validated against
      // ALLOWED_HOSTS, capped at 3 redirects.
      const MAX_REDIRECTS = 3;
      let current = parsed;
      let upstream;
      for (let hop = 0; ; hop++) {
        upstream = await fetch(current.toString(), {
          headers: { 'User-Agent': 'SCL-Site-Proxy/1.0' },
          redirect: 'manual',
          cf: { cacheTtl: 600, cacheEverything: true }, // 10 min edge cache
        });

        if (upstream.status < 300 || upstream.status >= 400) break;

        const location = upstream.headers.get('Location');
        if (!location) break; // 3xx without Location: pass through as-is

        if (hop >= MAX_REDIRECTS) {
          return new Response('Too many redirects', { status: 502, headers: cors });
        }

        let next;
        try {
          next = new URL(location, current);
        } catch {
          return new Response('Invalid redirect', { status: 502, headers: cors });
        }
        if (next.protocol !== 'https:' || !ALLOWED_HOSTS.includes(next.hostname)) {
          return new Response('Redirect target not allowed', { status: 403, headers: cors });
        }
        current = next;
      }

      const body = await upstream.arrayBuffer();
      const headers = new Headers(cors);
      const ct = upstream.headers.get('content-type');
      if (ct) headers.set('Content-Type', ct);
      headers.set('Cache-Control', 'public, max-age=600');

      return new Response(body, { status: upstream.status, headers });
    } catch (err) {
      return new Response('Upstream fetch failed', { status: 502, headers: cors });
    }
  },
};
