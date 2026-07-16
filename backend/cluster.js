const cluster = require('cluster')
const os = require('os')

const numCPUs = Math.min(os.availableParallelism?.() || os.cpus().length, 4)

if (cluster.isPrimary) {
  console.log(`[CLUSTER] Primary ${process.pid} is running`)
  console.log(`[CLUSTER] Forking ${numCPUs} workers`)

  const restarts = new Map()
  const MAX_RESTARTS = 10
  const RESTART_WINDOW = 60 * 1000

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now()
    const pid = worker.process.pid
    console.log(`[CLUSTER] Worker ${pid} died (code: ${code}, signal: ${signal})`)

    if (!restarts.has(pid)) restarts.set(pid, [])
    const times = restarts.get(pid).filter((t) => now - t < RESTART_WINDOW)
    times.push(now)
    restarts.set(pid, times)

    if (times.length >= MAX_RESTARTS) {
      console.error(`[CLUSTER] Worker ${pid} restarted ${MAX_RESTARTS} times in ${RESTART_WINDOW / 1000}s — giving up`)
      return
    }

    console.log('[CLUSTER] Forking a replacement worker...')
    cluster.fork()
  })

  cluster.on('listening', (worker, address) => {
    console.log(`[CLUSTER] Worker ${worker.process.pid} listening on port ${address.port}`)
  })
} else {
  const { startServer } = require('./index')
  startServer()
}
