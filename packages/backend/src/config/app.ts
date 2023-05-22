import 'dotenv/config'

import { URL } from 'node:url'

type AppConfig = {
  port: string
  webAppUrl: string
  webhookUrl: string
  appEnv: string
  isDev: boolean
  postgresDatabase: string
  postgresPort: number
  postgresHost: string
  postgresUsername: string
  postgresPassword?: string
  version: string
  postgresEnableSsl: boolean
  baseUrl: string
  encryptionKey: string
  sessionSecretKey: string
  serveWebAppSeparately: boolean
  redisHost: string
  redisPort: number
  redisUsername: string
  redisPassword: string
  redisTls: boolean
  redisClusterMode: boolean
  enableBullMQDashboard: boolean
  bullMQDashboardUsername: string
  bullMQDashboardPassword: string
  requestBodySizeLimit: string
  postmanApiKey: string
  isWorker: boolean
  workerActionConcurrency: number
}

const port = process.env.PORT || '3000'

// use apiUrl by default, which has less priority over the following cases

let webAppUrl = new URL(process.env.WEB_APP_URL).toString()
webAppUrl = webAppUrl.substring(0, webAppUrl.length - 1) // remove trailing slash

let webhookUrl = new URL(process.env.WEBHOOK_URL).toString()
webhookUrl = webhookUrl.substring(0, webhookUrl.length - 1) // remove trailing slash

const appEnv = process.env.APP_ENV || 'development'

const appConfig: AppConfig = {
  port,
  appEnv: appEnv,
  isDev: appEnv === 'development',
  version: process.env.npm_package_version,
  postgresDatabase: process.env.POSTGRES_DATABASE || 'plumber_dev',
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresUsername: process.env.POSTGRES_USERNAME,
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresEnableSsl: process.env.POSTGRES_ENABLE_SSL === 'true',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  sessionSecretKey: process.env.SESSION_SECRET_KEY || '',
  serveWebAppSeparately: process.env.SERVE_WEB_APP_SEPARATELY === 'true',
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  redisUsername: process.env.REDIS_USERNAME,
  redisPassword: process.env.REDIS_PASSWORD,
  redisTls: process.env.REDIS_TLS === 'true',
  redisClusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
  enableBullMQDashboard: process.env.ENABLE_BULLMQ_DASHBOARD === 'true',
  bullMQDashboardUsername: process.env.BULLMQ_DASHBOARD_USERNAME,
  bullMQDashboardPassword: process.env.BULLMQ_DASHBOARD_PASSWORD,
  baseUrl: process.env.BASE_URL,
  webAppUrl,
  webhookUrl,
  requestBodySizeLimit: '1mb',
  postmanApiKey: process.env.POSTMAN_API_KEY,
  isWorker: /worker\.(ts|js)$/.test(require.main.filename),
  workerActionConcurrency: parseInt(
    process.env.WORKER_ACTION_CONCURRENCY || '10',
  ),
}

if (!appConfig.encryptionKey) {
  throw new Error('ENCRYPTION_KEY environment variable needs to be set!')
}

if (!appConfig.sessionSecretKey) {
  throw new Error('SESSION_SECRET_KEY environment variable needs to be set!')
}

if (!appConfig.postmanApiKey) {
  throw new Error('POSTMAN_API_KEY environment variable needs to be set!')
}

export default appConfig
