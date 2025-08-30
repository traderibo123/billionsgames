// SW: stale-while-revalidate image cache (logo için yeni versiyon)
const CACHE = 'pfp-cache-v3_8';
const HOSTS = ['images.weserv.nl','robohash.org','unavatar.io'];

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const cached = await c.match(e.request);
      const network = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })
        .catch(() => cached || Response.error());
      return cached || network;
    })());
  }
});
