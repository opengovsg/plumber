import { existsSync } from 'node:fs'

// The server and worker containers start these paths. tsc can succeed while
// writing them under dist/src/ when an input sits outside src/.
const entries = ['dist/server.js', 'dist/worker.js']
const missing = entries.filter((entry) => !existsSync(entry))

if (missing.length > 0) {
  console.error(`Missing build entry: ${missing.join(', ')}`)
  process.exit(1)
}
