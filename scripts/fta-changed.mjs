import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Fails when a file changed since the merge base with the base ref exceeds the
 * score_cap in fta.json.
 *
 * Usage: node scripts/fta-changed.mjs [base-ref]
 */

const baseRef = process.argv[2] ?? 'origin/develop-v2'
const { score_cap: scoreCap } = JSON.parse(readFileSync('fta.json', 'utf8'))

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const mergeBase = git('merge-base', baseRef, 'HEAD')
const changedFiles = new Set(
  git('diff', '--name-only', '--diff-filter=ACMR', mergeBase)
    .split('\n')
    .filter(Boolean),
)

// FTA only analyzes whole directories. A full run takes well under a second.
// The CLI cap is raised so FTA reports every score instead of exiting on the
// first file over fta.json's cap.
const results = JSON.parse(
  execFileSync('fta', ['.', '--json', '--score-cap', '1000'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
)

const changedResults = results
  .filter((result) => changedFiles.has(result.file_name))
  .sort((a, b) => b.fta_score - a.fta_score)

if (changedResults.length === 0) {
  console.log(`No analyzed files changed since ${baseRef}.`)
  process.exit(0)
}

for (const { file_name, fta_score, assessment } of changedResults) {
  const marker = fta_score > scoreCap ? '✗' : '✓'
  console.log(
    `${marker} ${fta_score.toFixed(2)}  ${assessment.padEnd(17)}  ${file_name}`,
  )
}

const failures = changedResults.filter((result) => result.fta_score > scoreCap)
if (failures.length > 0) {
  console.error(
    `\n${failures.length} changed file(s) exceed the FTA score cap of ${scoreCap}. Split or simplify them.`,
  )
  process.exit(1)
}

console.log(
  `\nAll ${changedResults.length} changed file(s) are within the FTA score cap of ${scoreCap}.`,
)
