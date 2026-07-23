const cluster = require('cluster')
const os = require('os')
const logger = require('./logger')

const numCPUs = Math.min(os.availableParallelism?.() || os.cpus().length, 4)

if (cluster.isPrimary) {
  logger.info({ pid: process.pid, workers: numCPUs }, 'Primary process running')

  const restarts = new Map()
  const MAX_RESTARTS = 10
  const RESTART_WINDOW = 60 * 1000

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now()
    const wid = worker.id
    logger.warn({ workerId: wid, pid: worker.process.pid, code, signal }, 'Worker died')

    if (!restarts.has(wid)) restarts.set(wid, [])
    const times = restarts.get(wid).filter((t) => now - t < RESTART_WINDOW)
    times.push(now)
    restarts.set(wid, times)

    if (times.length >= MAX_RESTARTS) {
      logger.error(
        { workerId: wid, restarts: times.length, windowSec: RESTART_WINDOW / 1000 },
        'Worker exceeded max restarts — giving up',
      )
      restarts.delete(wid)
      return
    }

    logger.info('Forking replacement worker')
    cluster.fork()
  })

  cluster.on('listening', (worker, address) => {
    logger.info({ pid: worker.process.pid, port: address.port }, 'Worker listening')
  })
} else {
  const { startServer } = require('./index')
  startServer()
}
