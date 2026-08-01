const cluster = require('cluster')
const os = require('os')
const logger = require('./logger')

const numCPUs = Math.min(os.availableParallelism?.() || os.cpus().length, 4)

if (cluster.isPrimary) {
  logger.info({ pid: process.pid, workers: numCPUs }, 'Primary process running')

  const MAX_RESTARTS = 10
  const RESTART_WINDOW = 60 * 1000
  const RESTART_DELAY = 1500

  // Track restart counts per pool slot. We must NOT key off worker.id — Node
  // assigns each newly forked worker a fresh, monotonically increasing id, so a
  // keyed-by-id map would never accumulate and the "give up" branch below would
  // be unreachable. Keying by slot keeps a crash-looping worker from being
  // re-forked endlessly at full speed.
  const slots = Array.from({ length: numCPUs }, (_, index) => ({
    index,
    worker: null,
    restarts: [],
  }))

  function forkSlot(index) {
    const slot = slots[index]
    const worker = cluster.fork()
    slot.worker = worker
    slot.restarts = slot.restarts.filter((t) => Date.now() - t < RESTART_WINDOW)
    return worker
  }

  function reforkLater(slot, delayMs) {
    setTimeout(() => {
      if (!slot.worker) forkSlot(slot.index)
    }, delayMs)
  }

  for (let i = 0; i < numCPUs; i++) forkSlot(i)

  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now()
    const slot = slots.find((s) => s.worker && s.worker.id === worker.id)
    logger.warn({ pid: worker.process.pid, code, signal }, 'Worker died')

    if (!slot) {
      logger.info('Forking replacement worker')
      cluster.fork()
      return
    }

    slot.worker = null
    slot.restarts.push(now)
    slot.restarts = slot.restarts.filter((t) => now - t < RESTART_WINDOW)

    if (slot.restarts.length >= MAX_RESTARTS) {
      logger.error(
        { restarts: slot.restarts.length, windowSec: RESTART_WINDOW / 1000 },
        'Worker exceeded max restarts in window — pausing restarts',
      )
      slot.restarts = []
      reforkLater(slot, RESTART_WINDOW)
      return
    }

    reforkLater(slot, RESTART_DELAY)
  })

  cluster.on('listening', (worker, address) => {
    logger.info({ pid: worker.process.pid, port: address.port }, 'Worker listening')
  })
} else {
  const { startServer } = require('./index')
  startServer()
}
