import './load-app-env'
import { requireEnv } from './require-env'

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
  postgresUsername: requireEnv(
    'POSTGRES_USERNAME',
    process.env.POSTGRES_USERNAME,
  ),
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
}

export default dbConfig
