const cluster = require('cluster')
const logger = require('./logger')

class MemoryCache {
  constructor(defaultTTL = 300000, maxEntries = 1000) {
    this.store = new Map()
    this.defaultTTL = defaultTTL
    this.maxEntries = maxEntries
    const interval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    interval.unref()

    // In cluster mode, listen for cache invalidation messages from primary
    if (cluster.isWorker) {
      process.on('message', (msg) => {
        if (msg.type === 'cache:invalidate') {
          this.store.delete(msg.key)
          logger.debug({ key: msg.key }, 'Cache invalidated via IPC')
        }
        if (msg.type === 'cache:clear') {
          this.store.clear()
          logger.debug('Cache cleared via IPC')
        }
      })
    }
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

    // Broadcast invalidation to other workers in cluster mode
    if (cluster.isPrimary) {
      for (const id in cluster.workers) {
        cluster.workers[id].send({ type: 'cache:invalidate', key })
      }
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

    // Broadcast clear to all workers
    if (cluster.isPrimary) {
      for (const id in cluster.workers) {
        cluster.workers[id].send({ type: 'cache:clear' })
      }
    }
  }
}

module.exports = new MemoryCache()
