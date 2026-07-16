class MemoryCache {
  constructor(defaultTTL = 300000) {
    this.store = new Map()
    this.defaultTTL = defaultTTL
    this._cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
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

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiry) this.store.delete(key)
    }
  }

  clear() {
    this.store.clear()
  }

  destroy() {
    clearInterval(this._cleanupInterval)
    this.store.clear()
  }
}

module.exports = new MemoryCache()
