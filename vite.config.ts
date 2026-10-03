import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

// Still talks to nobody: no fonts, scripts or requests leave its own origin. The same
// policy goes out from vercel.json, and from `vite preview` so it can be tested here.
const HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
    "font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Emits sw.js with the exact list of files in this build, so the app opens with no network. */
function offline(): Plugin {
  return {
    name: 'still-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map') && !f.endsWith('.woff'));
      const pub = readdirSync('public').filter((f) => f !== 'sw.js');
      const files = ['/', ...pub.map((f) => `/${f}`), ...built.map((f) => `/${f}`)];
      const index = bundle['index.html'];
      const html = index && 'source' in index ? String(index.source) : '';
      const version = createHash('sha256').update(files.join('|') + html).digest('hex').slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// Generated at build time. Caches Still's own files only.
const CACHE = 'still-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // The page itself: straight from the cache (instant, works offline), refreshed in the background.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('/', { ignoreSearch: true }).then((hit) => {
        const fresh = fetch('/').then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put('/', r.clone()));
          return r;
        });
        e.waitUntil(fresh.catch(() => {}));
        return hit || fresh;
      }),
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`,
      });
    },
  };
}

export default defineConfig({
  plugins: [offline()],
  preview: { headers: HEADERS },
});
