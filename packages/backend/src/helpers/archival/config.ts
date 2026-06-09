import 'dotenv/config'

export const archivalConfig = {
  isDev: (process.env.APP_ENV ?? 'development') === 'development',
  // Postgres — mirrors the fields used by @/config/database
  postgresHost:
    process.env.RDS_PROXY_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
  postgresPort: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  postgresDatabase: process.env.POSTGRES_DATABASE ?? 'plumber_dev',
  postgresUsername: process.env.POSTGRES_USERNAME ?? 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
  // S3 dev credentials (prod uses IAM role — no explicit credentials needed)
  s3Endpoint: process.env.S3_ENDPOINT,
  s3AccessKey: process.env.S3_ACCESS_KEY,
  s3SecretKey: process.env.S3_SECRET_KEY,
  // Archival job settings
  archiveEnabled: process.env.ARCHIVE_ENABLED === 'true',
  archiveDryRun: process.env.ARCHIVE_DRY_RUN === 'true',
  archiveRetentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS ?? '90', 10),
  archiveBatchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE ?? '500', 10),
  archiveBatchSleepMs: parseInt(
    process.env.ARCHIVE_BATCH_SLEEP_MS ?? '2000',
    10,
  ),
  archiveExecutionsBucket: process.env.ARCHIVE_EXECUTIONS_BUCKET ?? '',
  archiveTestExecutionsBucket:
    process.env.ARCHIVE_TEST_EXECUTIONS_BUCKET ?? '',
}
