const importQueue = []
let importWorkerRunning = false

async function importWorker() {
  if (importWorkerRunning) return
  importWorkerRunning = true
  while (importQueue.length > 0) {
    const task = importQueue.shift()
    try {
      await task()
    } catch (e) {
      console.error('[ImportWorker] Task failed:', e)
    }
  }
  importWorkerRunning = false
}

function enqueueImport(task) {
  importQueue.push(task)
  importWorker()
}

module.exports = { enqueueImport }
