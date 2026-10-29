import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// IMPORTANT: Under "module": "nodenext", tsc emits import() as a native ESM
// import instead of require(). tsc cannot check a computed specifier, so a
// missing file extension only fails at runtime.
const distDir = process.argv[2]
if (!distDir) {
  console.error('Usage: node assert-no-dynamic-import.mjs <dist-dir>')
  process.exit(1)
}

const offenders = readdirSync(distDir, { recursive: true })
  .filter((file) => file.endsWith('.js'))
  // Vitest runs tests from src, so their compiled copies never execute.
  .filter((file) => !/(__tests__|\.i?test\.js$)/.test(file))
  .filter((file) =>
    /\bimport\(/.test(readFileSync(join(distDir, file), 'utf8')),
  )

if (offenders.length > 0) {
  console.error(
    `Dynamic import() found in compiled output. Use a static import instead:\n${offenders
      .map((file) => `  ${join(distDir, file)}`)
      .join('\n')}`,
  )
  process.exit(1)
}
