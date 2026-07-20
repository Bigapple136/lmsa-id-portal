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
    const wid = worker.id
    console.log(`[CLUSTER] Worker ${wid} (pid ${worker.process.pid}) died (code: ${code}, signal: ${signal})`)

    if (!restarts.has(wid)) restarts.set(wid, [])
    const times = restarts.get(wid).filter((t) => now - t < RESTART_WINDOW)
    times.push(now)
    restarts.set(wid, times)

    if (times.length >= MAX_RESTARTS) {
      console.error(`[CLUSTER] Worker ${wid} restarted ${MAX_RESTARTS} times in ${RESTART_WINDOW / 1000}s — giving up`)
      restarts.delete(wid)
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
