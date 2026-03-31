const memoryCache = new Map();

export async function resolveCachedResource(key, options) {
  const now = Date.now();
  const cached = memoryCache.get(key);
  const ttlMs = Math.max(1, Number(options.ttlMs) || 1);
  const isFresh = cached && now - cached.cachedAt <= ttlMs;

  if (isFresh && !options.forceRefresh) {
    return {
      value: cloneValue(cached.value),
      cache: buildCacheMeta('fresh', cached.cachedAt, now - cached.cachedAt)
    };
  }

  try {
    const value = await options.loader();
    const liveValue = options.isLiveValue ? options.isLiveValue(value) : true;

    if (liveValue) {
      memoryCache.set(key, {
        value: cloneValue(value),
        cachedAt: now
      });

      return {
        value,
        cache: buildCacheMeta(cached ? 'refreshed' : 'live', now, 0)
      };
    }

    if (cached) {
      return {
        value: cloneValue(cached.value),
        cache: buildCacheMeta(
          'stale',
          cached.cachedAt,
          now - cached.cachedAt,
          options.fallbackReason ? options.fallbackReason(value) : 'Current request returned fallback data.'
        )
      };
    }

    return {
      value,
      cache: buildCacheMeta(
        'fallback',
        null,
        0,
        options.fallbackReason ? options.fallbackReason(value) : 'Current request returned fallback data.'
      )
    };
  } catch (error) {
    if (cached) {
      return {
        value: cloneValue(cached.value),
        cache: buildCacheMeta('stale', cached.cachedAt, now - cached.cachedAt, error.message)
      };
    }

    throw error;
  }
}

function buildCacheMeta(status, cachedAt, ageMs, reason = '') {
  return {
    status,
    layer: 'memory',
    cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    ageMs,
    reason
  };
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
