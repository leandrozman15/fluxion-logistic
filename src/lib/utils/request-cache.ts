type CacheEntry<T> = { promise: Promise<T>; timestamp: number };

const store = new Map<string, CacheEntry<any>>();

/**
 * Cachea en memoria (por pestaña/sesión del browser) el resultado de una función async por
 * `ttlMs` milisegundos, y deduplica llamados concurrentes con la misma key en un único fetch
 * en curso.
 *
 * Pensado para listados/perfiles que se piden de nuevo en cada pantalla del dashboard
 * (choferes, camiones, perfil del tenant) y que no cambian segundo a segundo: evita repetir
 * la misma request de red cada vez que el usuario navega entre pantallas, que era la causa de
 * que la app se sintiera lenta para cargar cada pantalla.
 */
export function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = store.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.promise;
  }

  const promise = fetcher().catch((err) => {
    // No dejamos una promesa rechazada en cache: el próximo llamado debe reintentar la request.
    store.delete(key);
    throw err;
  });

  store.set(key, { promise, timestamp: Date.now() });
  return promise;
}

/** Invalida una entrada puntual (ej. después de crear/editar/borrar un registro). */
export function invalidateCache(key: string) {
  store.delete(key);
}

/** Invalida todas las entradas cuya key empiece con `prefix` (ej. "drivers:"). */
export function invalidateCachePrefix(prefix: string) {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
