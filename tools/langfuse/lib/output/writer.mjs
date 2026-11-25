import { createWriteStream } from 'node:fs'
import { join } from 'node:path'

import { EXPORT_FILE_MODE, OUT_DIR } from '../constants.mjs'
import { formatDate } from '../utils/dates.mjs'

export function toCsvCell(value) {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  // Spreadsheets evaluate cells that start with these characters as formulas.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildOutputPath(options, now = new Date()) {
  const runAt = now.toISOString().replace(/[:.]/g, '-')
  const scope = options.sessionId
    ? `session-${options.sessionId}`
    : `${options.range.from ? formatDate(options.range.from) : 'all-time'}_to_${formatDate(new Date(options.range.to.getTime() - 1))}`
  return join(
    OUT_DIR,
    `sessions_${options.project}_${options.environment}_${scope}_${runAt}.${options.format}`,
  )
}

/**
 * Streams records to a JSON array or CSV file, so large exports never sit in memory.
 */
export function createWriter(path, format, columns) {
  // Exclusive create, so an existing file with broader permissions is never reused.
  const stream = createWriteStream(path, {
    encoding: 'utf-8',
    flags: 'wx',
    mode: EXPORT_FILE_MODE,
  })
  let count = 0

  const write = (chunk) =>
    new Promise((resolve, reject) => {
      stream.write(chunk, (error) => (error ? reject(error) : resolve()))
    })

  return {
    async start() {
      await write(format === 'json' ? '[\n' : `${columns.join(',')}\n`)
    },
    async add(record) {
      if (format === 'json') {
        await write(
          `${count > 0 ? ',\n' : ''}${JSON.stringify(record, null, 2)}`,
        )
      } else {
        await write(
          `${columns.map((column) => toCsvCell(record[column])).join(',')}\n`,
        )
      }
      count++
    },
    async end() {
      if (format === 'json') {
        await write('\n]\n')
      }
      await new Promise((resolve, reject) => {
        stream.end((error) => (error ? reject(error) : resolve()))
      })
      return count
    },
  }
}
