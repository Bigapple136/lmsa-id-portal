class MemoryCache {
  constructor(defaultTTL = 300000, maxEntries = 1000) {
    this.store = new Map()
    this.defaultTTL = defaultTTL
    this.maxEntries = maxEntries
    const interval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    interval.unref()
  }

  get(key) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key, value, ttlMs) {
    this.store.delete(key)
    this.store.set(key, { value, expiry: Date.now() + (ttlMs || this.defaultTTL) })
    if (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      this.store.delete(oldest)
    }
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiry) this.store.delete(key)
    }
  }

  clear() {
    this.store.clear()
  }
}

module.exports = new MemoryCache()
