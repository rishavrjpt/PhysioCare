/**
 * In-memory client-side data store with TTL caching, Stale-While-Revalidate,
 * and cross-tab/component synchronization for PhysioCare.
 */

const cache = new Map(); // key -> { value, expiresAt, isFetching }
const subscribers = new Map(); // key -> Set<callback>

export function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) return null;
  return item.value;
}

export function set(key, value, ttlMs = 30000) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    isFetching: false
  });
  notifySubscribers(key, value);
}

export function invalidate(keyOrPrefix) {
  for (const k of Array.from(cache.keys())) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      cache.delete(k);
    }
  }
}

export function subscribe(key, callback) {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);
  return () => unsubscribe(key, callback);
}

export function unsubscribe(key, callback) {
  if (subscribers.has(key)) {
    subscribers.get(key).delete(callback);
    if (subscribers.get(key).size === 0) {
      subscribers.delete(key);
    }
  }
}

function notifySubscribers(key, value) {
  if (subscribers.has(key)) {
    subscribers.get(key).forEach((cb) => {
      try {
        cb(value);
      } catch (err) {
        console.error("DataStore subscriber notification error:", err);
      }
    });
  }
}

/**
 * cachedFetch returns cached data instantly if fresh, otherwise fetches.
 * Supports stale-while-revalidate: returns stale data immediately and refetches
 * in the background, notifying subscribers when fresh data arrives.
 */
export async function cachedFetch(key, url, { ttl = 30000, fetchOptions = {}, revalidate = true } = {}) {
  const item = cache.get(key);
  const now = Date.now();

  // Fresh cache hit
  if (item && now < item.expiresAt) {
    return item.value;
  }

  // Stale cache hit: return stale data immediately and refetch in background
  if (item && revalidate) {
    if (!item.isFetching) {
      item.isFetching = true;
      fetch(url, fetchOptions)
        .then(async (res) => {
          if (res.ok) {
            const freshData = await res.json();
            set(key, freshData, ttl);
          }
        })
        .catch((err) => {
          console.error("Background revalidation failed for", key, err);
        })
        .finally(() => {
          const current = cache.get(key);
          if (current) current.isFetching = false;
        });
    }
    return item.value;
  }

  // No cache at all: fetch now
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}`);
  }
  const data = await res.json();
  set(key, data, ttl);
  return data;
}

// Cross-tab synchronization via BroadcastChannel
let broadcastChannel = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel("physiocare");
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "profile-updated") {
        const uid = event.data.userId;
        handleProfileInvalidation(uid, false);
      }
    };
  } catch (err) {
    console.error("BroadcastChannel init error:", err);
  }
}

function handleProfileInvalidation(userId, notifyBroadcast = true) {
  if (userId) {
    invalidate(`user:${userId}`);
    invalidate(`doctor:${userId}`);
  }
  invalidate("doctors:");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("physiocare:profile-updated", { detail: { userId } }));
  }

  if (notifyBroadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "profile-updated", userId });
    } catch (e) {
      console.error("BroadcastChannel postMessage error:", e);
    }
  }
}

export function emitProfileUpdated(userId) {
  handleProfileInvalidation(userId, true);
}
