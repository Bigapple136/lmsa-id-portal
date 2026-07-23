const logger = require('./logger')

const importQueue = []
let importWorkerRunning = false
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function runWithRetry(task, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await task()
      return
    } catch (e) {
      logger.error({ err: e, attempt, maxRetries: retries }, 'Import task failed')
      if (attempt < retries) {
        logger.info({ retryIn: RETRY_DELAY_MS * attempt }, 'Retrying import task')
        await delay(RETRY_DELAY_MS * attempt)
      } else {
        logger.error({ err: e }, 'Import task failed after all retries — dropping task')
      }
    }
  }
}

async function importWorker() {
  if (importWorkerRunning) return
  importWorkerRunning = true
  while (importQueue.length > 0) {
    const task = importQueue.shift()
    await runWithRetry(task)
  }
  importWorkerRunning = false
}

function enqueueImport(task) {
  importQueue.push(task)
  importWorker()
}

module.exports = { enqueueImport }
