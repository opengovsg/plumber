import 'dotenv/config'

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

export const archivalConfig = {
  isDev: (process.env.APP_ENV ?? 'development') === 'development',
  // Postgres — mirrors the fields used by @/config/database
  postgresHost:
    process.env.RDS_PROXY_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
  postgresPort: requireInt('POSTGRES_PORT', 5432),
  postgresDatabase: process.env.POSTGRES_DATABASE ?? 'plumber_dev',
  postgresUsername: process.env.POSTGRES_USERNAME ?? 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
  // Postgres reader endpoint for archival read traffic (eligibility scan,
  // execution_steps fetch, Phase 5 cleanup fetches). Must be set explicitly —
  // reads never fall back to the writer. Use localhost for local dev.
  postgresReaderHost: requireString('ARCHIVE_POSTGRES_READER_HOST'),
  // S3 dev credentials (prod uses IAM role — no explicit credentials needed)
  s3Endpoint: process.env.S3_ENDPOINT,
  s3AccessKey: process.env.S3_ACCESS_KEY,
  s3SecretKey: process.env.S3_SECRET_KEY,
  // Archival job settings
  archiveEnabled: process.env.ARCHIVE_ENABLED === 'true',
  archiveDryRun: process.env.ARCHIVE_DRY_RUN === 'true',
  archiveRetentionDays: requireInt('ARCHIVE_RETENTION_DAYS', 365),
  archiveBatchSize: requireInt('ARCHIVE_BATCH_SIZE', 500),
  archiveBatchSleepMs: requireInt('ARCHIVE_BATCH_SLEEP_MS', 2000),
  archiveBucket: requireString('ARCHIVE_BUCKET'),
}
