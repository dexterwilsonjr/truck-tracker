import { createHash } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

const version = createHash("sha256").update(readFileSync("dist/index.html")).digest("hex").slice(0, 12)
const skip = /^(LiveMapPanel|maplibre)/i
const precache = [
  "/index.html",
  ...readdirSync("dist/assets")
    .filter((name) => !skip.test(name))
    .map((name) => `/assets/${name}`),
]

writeFileSync(
  "dist/sw.js",
  `const CACHE = 'tt-shell-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tt-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html').then(cached => cached || Response.error())));
    return;
  }
  if (!url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});
`,
)
