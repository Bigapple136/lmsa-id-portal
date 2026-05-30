class MemoryCache {
  constructor(defaultTTL = 300000) {
    this.store = new Map()
    this.defaultTTL = defaultTTL
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
    this.store.set(key, { value, expiry: Date.now() + (ttlMs || this.defaultTTL) })
  }

  clear() {
    this.store.clear()
  }
}

module.exports = new MemoryCache()
