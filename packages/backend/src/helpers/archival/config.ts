import 'dotenv/config'

const isDev = (process.env.APP_ENV ?? 'development') === 'development'

function requireInt(name: string, defaultValue: number): number {
  const raw = process.env[name]
  const value = parseInt(raw ?? String(defaultValue), 10)
  if (isNaN(value)) {
    throw new Error(`${name} must be a valid integer, got: "${raw}"`)
  }
  return value
}

function requireString(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set`)
  }
  return value
}

// Falls back to devDefault in dev; throws in non-dev envs.
function devString(name: string, devDefault: string): string {
  const value = process.env[name]
  if (value) {
    return value
  }
  if (isDev) {
    return devDefault
  }
  throw new Error(`${name} must be set`)
}

export const archivalConfig = {
  isDev,
  // Postgres — mirrors the fields used by @/config/database
  postgresHost:
    process.env.RDS_PROXY_HOST ?? devString('POSTGRES_HOST', 'localhost'),
  postgresPort: requireInt('POSTGRES_PORT', 5432),
  postgresDatabase: devString('POSTGRES_DATABASE', 'plumber_dev'),
  postgresUsername: devString('POSTGRES_USERNAME', 'postgres'),
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
  // Postgres reader endpoint for archival read traffic (eligibility scan,
  // execution_steps fetch, Phase 5 cleanup fetches). Must be set explicitly —
  // reads never fall back to the writer. Use localhost for local dev.
  postgresReaderHost: requireString('ARCHIVE_POSTGRES_READER_HOST'),
  // S3 dev credentials (prod uses IAM role — no explicit credentials needed)
  s3Endpoint: isDev ? requireString('S3_ENDPOINT') : process.env.S3_ENDPOINT,
  s3AccessKey: isDev
    ? requireString('S3_ACCESS_KEY')
    : process.env.S3_ACCESS_KEY,
  s3SecretKey: isDev
    ? requireString('S3_SECRET_KEY')
    : process.env.S3_SECRET_KEY,
  // Archival job settings
  archiveEnabled: process.env.ARCHIVE_ENABLED === 'true',
  archiveDryRun: process.env.ARCHIVE_DRY_RUN === 'true',
  archiveRetentionDays: requireInt('ARCHIVE_RETENTION_DAYS', 365),
  archiveBatchSize: requireInt('ARCHIVE_BATCH_SIZE', 500),
  archiveBatchSleepMs: requireInt('ARCHIVE_BATCH_SLEEP_MS', 2000),
  archiveBucket: requireString('ARCHIVE_BUCKET'),
  // When true, only archive executions belonging to soft-deleted flows.
  // Use for phased rollout: archive low-risk data first.
  archiveDeletedFlowsOnly: process.env.ARCHIVE_DELETED_FLOWS_ONLY === 'true',
}
