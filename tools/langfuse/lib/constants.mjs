import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
)

// Names of the env vars that 1Password fills with each project's Langfuse keys.
export const PROJECT_CREDENTIAL_ENV = {
  aiBuilder: {
    publicKey: 'PAIR_ROME_AI_BUILDER_PUBLIC_KEY',
    secretKey: 'PAIR_ROME_AI_BUILDER_SECRET_KEY',
  },
  pairAction: {
    publicKey: 'PAIR_ROME_PAIR_ACTION_PUBLIC_KEY',
    secretKey: 'PAIR_ROME_PAIR_ACTION_SECRET_KEY',
  },
}
export const PROJECTS = Object.keys(PROJECT_CREDENTIAL_ENV)
export const ENVIRONMENTS = ['prod', 'staging', 'uat']
export const FORMATS = ['json', 'csv']

export const DEFAULTS = {
  project: 'aiBuilder',
  environment: 'prod',
  range: '30d',
  format: 'json',
  include: 'none',
  concurrency: 5,
  customRangeDays: 30,
}

export const RANGES = [
  { key: '1h', label: 'Last 1 hour', hours: 1 },
  { key: '1d', label: 'Last 1 day', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 7 * 24 },
  { key: '30d', label: 'Last 30 days', hours: 30 * 24 },
  { key: '90d', label: 'Last 90 days', hours: 90 * 24 },
  { key: 'all', label: 'All time', hours: null },
]

export const VALUE_FLAGS = [
  'project',
  'environment',
  'range',
  'from',
  'to',
  'format',
  'userId',
  'sessionId',
  'include',
  'concurrency',
]
export const BOOLEAN_FLAGS = ['yes']

export const EXTRA_FIELDS = [
  'metrics',
  'counts',
  'metadata',
  'fullOutput',
  'observations',
  'scores',
]
// These need one extra request per session. Everything else comes from the last-trace lookup.
export const SLOW_FIELDS = ['observations', 'scores']
// Copied from the trace as is, under the same name.
export const PASSTHROUGH_FIELDS = ['metadata', 'observations', 'scores']

export const DETAIL_LEVELS = [
  { key: 'none', label: 'Core fields only (fast)' },
  { key: 'metadata', label: 'Core fields + metadata (fast)' },
  {
    key: 'metrics,counts',
    label:
      'Core fields + latency, cost and counts (slower, Langfuse computes them per trace)',
  },
  {
    key: 'all',
    label:
      'Everything, with full LLM output, observations and scores (slow, one extra request per session)',
  },
]

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const CLIENT_TIMEOUT_MS = 60_000
export const REQUEST_OPTIONS = { maxRetries: 4, timeoutInSeconds: 60 }
// Langfuse caps list endpoints at 100 items per page.
export const PAGE_SIZE = 100
export const MIN_PAGE_SIZE = 10
export const INITIAL_WINDOW_MS = 3_600_000
export const MIN_WINDOW_MS = 60_000
// Rome times out on large queries, so keep windows small.
export const TARGET_SESSIONS_PER_WINDOW = 100
export const OUTAGE_RETRY_DELAYS_MS = [10_000, 30_000, 60_000]
// Langfuse launched in 2023, so "All time" starts here.
export const ALL_TIME_START = new Date('2023-01-01T00:00:00Z')
// A slow early item must not let workers race ahead and buffer every later result in memory.
export const MAX_AHEAD_PER_WORKER = 4

// Exports hold conversation data, so only the owner may read them.
export const EXPORT_FILE_MODE = 0o600
export const EXPORT_DIR_MODE = 0o700

export const ANSI = {
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  clearLine: '\x1b[2K',
  clearToLineEnd: '\x1b[K',
  clearToScreenEnd: '\x1b[0J',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  cursorUp: (lines) => `\x1b[${lines}A`,
}
