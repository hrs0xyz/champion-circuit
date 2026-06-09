/**
 * Persists hero GLBs in the Cache API and exposes blob URLs so GLTFLoader
 * reads from memory after the first fetch (repeat visits + faster carousel).
 */

const CACHE_NAME = 'champion-circuit-hero-glb-v1';

const inflight = new Map<string, Promise<string>>();

async function fetchAndStore(url: string): Promise<Blob> {
  if (typeof caches === 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load model: ${url}`);
    return res.blob();
  }

  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load model: ${url}`);
    await cache.put(url, response.clone());
  }
  return response.blob();
}

/**
 * Single-flight: same URL shares one network/cache read; returns a stable blob URL per process.
 */
export function ensureModelBlobUrl(url: string): Promise<string> {
  let p = inflight.get(url);
  if (p) return p;

  p = (async () => {
    const blob = await fetchAndStore(url);
    return URL.createObjectURL(blob);
  })();

  inflight.set(url, p);
  return p;
}

type Entry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'ok'; blobUrl: string }
  | { status: 'error'; error: unknown };

const suspenseEntries = new Map<string, Entry>();

function getSuspenseEntry(url: string): Entry {
  let e = suspenseEntries.get(url);
  if (e) return e;

  const promise = ensureModelBlobUrl(url).then(
    (blobUrl) => {
      suspenseEntries.set(url, { status: 'ok', blobUrl });
    },
    (error) => {
      suspenseEntries.set(url, { status: 'error', error });
    },
  );

  e = { status: 'pending', promise };
  suspenseEntries.set(url, e);
  return e;
}

/**
 * For use inside <Suspense>: throws a promise until the model resolves to a blob URL.
 */
export function readModelSrcSuspense(logicalUrl: string): string {
  const entry = getSuspenseEntry(logicalUrl);
  if (entry.status === 'pending') throw entry.promise;
  if (entry.status === 'error') throw entry.error;
  return entry.blobUrl;
}

/**
 * Start loading every URL immediately; first to finish can be shown first (completion order).
 */
export function prefetchHeroModels(urls: readonly string[]): void {
  for (const u of urls) {
    void ensureModelBlobUrl(u);
  }
}
