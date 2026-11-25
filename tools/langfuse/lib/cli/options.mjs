import {
  BOOLEAN_FLAGS,
  DEFAULTS,
  ENVIRONMENTS,
  EXTRA_FIELDS,
  FORMATS,
  PROJECTS,
  RANGES,
  SLOW_FIELDS,
  VALUE_FLAGS,
} from '../constants.mjs'
import { customRange, rangeFromHours } from '../utils/dates.mjs'
import { fail } from '../utils/errors.mjs'
import { promptForMissing } from './menu.mjs'

function oneOf(flag, value, allowed) {
  if (!allowed.includes(value)) {
    fail(`--${flag} must be one of ${allowed.join(', ')}. Got "${value}".`)
  }
  return value
}

// Rejects typos, because a dropped filter would silently export more data than intended.
export function parseFlags(argv) {
  const flags = {}
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!match) {
      fail(`Unexpected argument "${arg}". Flags use the form --name=value.`)
    }
    const [, name, value] = match
    if (BOOLEAN_FLAGS.includes(name)) {
      if (value !== undefined) {
        fail(`--${name} does not take a value.`)
      }
      flags[name] = true
    } else if (VALUE_FLAGS.includes(name)) {
      if (!value?.trim()) {
        fail(`--${name} needs a value, as in --${name}=<value>.`)
      }
      flags[name] = value.trim()
    } else {
      fail(
        `Unknown flag --${name}. Valid flags: ${[...VALUE_FLAGS, ...BOOLEAN_FLAGS].join(', ')}.`,
      )
    }
  }
  return flags
}

export function parseInclude(value) {
  if (value === undefined || value === 'none') {
    return []
  }
  if (value === 'all') {
    return EXTRA_FIELDS
  }
  const fields = String(value)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
  for (const field of fields) {
    oneOf('include', field, [...EXTRA_FIELDS, 'all', 'none'])
  }
  return [...new Set(fields)]
}

function parseConcurrency(value) {
  const concurrency = Number(value ?? DEFAULTS.concurrency)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    fail('--concurrency must be a positive integer.')
  }
  return concurrency
}

function parseRange(flags) {
  if (flags.range && (flags.from || flags.to)) {
    fail('--range cannot be combined with --from or --to.')
  }
  if (flags.from || flags.to) {
    return customRange(flags.from, flags.to)
  }
  const key = oneOf(
    'range',
    flags.range ?? DEFAULTS.range,
    RANGES.map((range) => range.key),
  )
  return rangeFromHours(RANGES.find((range) => range.key === key).hours)
}

export async function resolveOptions(argv) {
  let flags = parseFlags(argv)

  const hasRangeFlag = flags.range || flags.from || flags.to || flags.sessionId
  if (!hasRangeFlag && !flags.yes && process.stdin.isTTY) {
    flags = await promptForMissing(flags)
  }

  const include = parseInclude(flags.include)
  return {
    project: oneOf('project', flags.project ?? DEFAULTS.project, PROJECTS),
    environment: oneOf(
      'environment',
      flags.environment ?? DEFAULTS.environment,
      ENVIRONMENTS,
    ),
    format: oneOf('format', flags.format ?? DEFAULTS.format, FORMATS),
    userId: flags.userId,
    sessionId: flags.sessionId,
    include,
    needsFullTrace: include.some((field) => SLOW_FIELDS.includes(field)),
    concurrency: parseConcurrency(flags.concurrency),
    range: parseRange(flags),
  }
}
