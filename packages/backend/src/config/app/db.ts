import { config } from 'dotenv'
import path from 'node:path'

// Placeholders backstop missing keys. Local dev gets its real values from 1Password,
// which dotenv never overrides.
// IMPORTANT: without the guard, placeholders would satisfy a deployed environment's
// missing-env-var checks.
if ((process.env.APP_ENV ?? 'development') === 'development') {
  config({ path: path.resolve(__dirname, '../../../.env-example') })
}

export type DbConfig = {
  postgresDatabase: string
  postgresPort: number
  postgresHost: string
  postgresUsername: string
  postgresPassword?: string
  postgresEnableSsl: boolean
}

const dbConfig: DbConfig = {
  postgresDatabase: process.env.POSTGRES_DATABASE || 'plumber_dev',
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
  postgresHost:
    process.env.RDS_PROXY_HOST || process.env.POSTGRES_HOST || 'localhost',
  postgresUsername: process.env.POSTGRES_USERNAME,
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
}

export default dbConfig
