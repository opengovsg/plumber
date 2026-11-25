import { ANSI } from '../constants.mjs'

const NON_TTY_LOG_INTERVAL_MS = 5000

export function printStatus(line, { keep = false } = {}) {
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}${ANSI.clearToLineEnd}${keep ? '\n' : ''}`)
  } else {
    console.log(line)
  }
}

export function createProgress(label) {
  const isTTY = process.stdout.isTTY
  const startedAt = Date.now()
  let lastLogged = 0

  return {
    update(done, total) {
      const elapsed = (Date.now() - startedAt) / 1000
      const rate = done / Math.max(elapsed, 0.001)
      const eta = rate > 0 ? Math.round((total - done) / rate) : 0
      const pct = total ? Math.floor((done / total) * 100) : 100
      const etaText =
        eta >= 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`
      const line = `${label}: ${done}/${total} (${pct}%) · ${rate.toFixed(1)}/s · ETA ${etaText}`
      if (isTTY) {
        process.stdout.write(`\r${line}${ANSI.clearToLineEnd}`)
      } else if (
        Date.now() - lastLogged > NON_TTY_LOG_INTERVAL_MS ||
        done === total
      ) {
        // Non-TTY output (CI, piped logs) cannot rewrite lines, so throttle instead.
        console.log(line)
        lastLogged = Date.now()
      }
    },
    finish() {
      if (isTTY) {
        process.stdout.write('\n')
      }
    },
  }
}
