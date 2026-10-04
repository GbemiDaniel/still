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
    // Runs last, after Vite has added index.html to the bundle: the version must change when only
    // the page changes (all the CSS is inline there), or installed copies would never update.
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (!bundle['index.html']) this.error('index.html missing from the bundle: the offline version would not track it');
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
  // cache: 'reload' skips the browser's HTTP cache, so this version never stores an older page.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Older versions are removed a little after this one takes over, not at once: a page that
// loaded the old index a moment ago can still fetch the old files it names. If the worker
// stops before then, the next activation clears them.
const dropOld = () => caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))));
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
  setTimeout(dropOld, 30000);
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // The page itself comes from this version's own cache, so it always matches the files cached
  // with it. A new deploy arrives as a new worker, and shows from the next launch.
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then((c) => c.match('/')).then((hit) => hit || fetch(req)));
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
