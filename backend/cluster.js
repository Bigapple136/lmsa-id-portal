const cluster = require('cluster')
const os = require('os')

const numCPUs = Math.min(os.availableParallelism?.() || os.cpus().length, 4)

if (cluster.isPrimary) {
  console.log(`[CLUSTER] Primary ${process.pid} is running`)
  console.log(`[CLUSTER] Forking ${numCPUs} workers`)

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[CLUSTER] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`)
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
