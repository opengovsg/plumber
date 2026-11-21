import { DATE_PATTERN, DEFAULTS } from '../constants.mjs'
import { fail } from './errors.mjs'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export function parseDate(flag, value) {
  if (!DATE_PATTERN.test(value)) {
    fail(`--${flag} must use the format YYYY-MM-DD. Got "${value}".`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Rejects dates like 2026-02-31, which Date silently rolls over.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    fail(`--${flag} is not a real date: "${value}".`)
  }
  return date
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

export function rangeFromHours(hours, now = new Date()) {
  if (hours === null) {
    return { from: undefined, to: now }
  }
  return { from: new Date(now.getTime() - hours * HOUR_MS), to: now }
}

// Both days are inclusive, so the range ends at the start of the day after --to.
export function customRange(fromValue, toValue) {
  const to = toValue ? addDays(parseDate('to', toValue), 1) : new Date()
  const from = fromValue
    ? parseDate('from', fromValue)
    : new Date(to.getTime() - DEFAULTS.customRangeDays * DAY_MS)
  if (from >= to) {
    fail('--from must be on or before --to.')
  }
  return { from, to }
}
