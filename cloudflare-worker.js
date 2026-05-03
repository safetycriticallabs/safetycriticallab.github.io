/**
 * SCL CORS Proxy — Cloudflare Worker
 * ------------------------------------
 * Acts as a CORS-friendly relay for the public regulatory feeds
 * the site already pulls (EUR-Lex, NIST). Replaces the unreliable
 * public proxies (corsproxy.io, api.cors.lol).
 *
 * Deploy: dashboard.cloudflare.com → Workers & Pages → Create → Worker
 * Paste this whole file as the Worker code, click Deploy, copy the URL
 * (e.g. https://scl-cors.kevinwilliams.workers.dev) and update
 * `CORS_PROXY` in ticker.js and index.html to:
 *   const CORS_PROXY = 'https://YOUR-WORKER-URL/?url=';
 *
 * Free tier: 100,000 requests/day. Your traffic is well below this.
 */

// Domains this proxy will fetch from. Anything else is rejected so
// the worker can't be abused as a general open proxy.
const ALLOWED_HOSTS = [
  'eur-lex.europa.eu',
  'www.federalregister.gov',
  'www.nist.gov',
  'csrc.nist.gov',
];

// Origin that's allowed to call this worker. '*' for any (less secure).
const ALLOWED_ORIGIN = 'https://safetycriticallabs.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: CORS_HEADERS });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: CORS_HEADERS });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: CORS_HEADERS });
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'SCL-Site-Proxy/1.0' },
        cf: { cacheTtl: 600, cacheEverything: true }, // 10 min edge cache
      });

      const body = await upstream.arrayBuffer();
      const headers = new Headers(CORS_HEADERS);
      const ct = upstream.headers.get('content-type');
      if (ct) headers.set('Content-Type', ct);
      headers.set('Cache-Control', 'public, max-age=600');

      return new Response(body, { status: upstream.status, headers });
    } catch (err) {
      return new Response('Upstream fetch failed', { status: 502, headers: CORS_HEADERS });
    }
  },
};
