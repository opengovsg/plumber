import 'dotenv/config'
import '@/types/luxon-extensions'

import type { AwsCredentialIdentity } from '@aws-sdk/types'
import { Settings as LuxonSettings } from 'luxon'
import { URL } from 'node:url'

type AppConfig = {
  port: string
  webAppUrl: string
  webhookUrl: string
  appEnv: string
  isProd: boolean
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
  adminJwtSecretKey: string
  serveWebAppSeparately: boolean
  redisHost: string
  redisPort: number
  redisUsername?: string
  redisPassword?: string
  redisTls: boolean
  redisClusterMode: boolean
  enableBullMQDashboard: boolean
  s3CommonBucket: string
  adminUserEmail: string
  requestBodySizeLimit: string
  postman: {
    apiKey: string
    fromAddress: string
    rateLimit: number
  }
  isWorker: boolean
  workerActionConcurrency: number
  sgid: {
    clientId: string
    clientSecret: string
    privateKey: string
  }
  launchDarklySdkKey: string
  maxJobAttempts: number
  onboardingEmailWebhookUrl: string
  tilesPostgres: {
    host: string
    port: number
    username: string
    password: string
    database: string
    enableSsl: boolean
  }
  sso: {
    clientId: string
    clientSecret: string
    discoveryUrl: string
  }
  gathersg: {
    publicKey: string
  }
  pair: {
    foundry: {
      apiKey: string
      model: string
      imageModel: string
    }
    rome: {
      baseUrl: string
      cloudflare: {
        zeroTrustClientKey: string
        zeroTrustSecretKey: string
      }
      aiBuilder: {
        publicKey: string
        secretKey: string
      }
      pairAction: {
        publicKey: string
        secretKey: string
      }
    }
  }
  ses: {
    fromAddress?: string
    region?: string
    roleArn: string
    configurationSet?: string
    sqsQueueUrl?: string
    /**
     * Only used for special scenarios (e.g. no SSO)
     */
    credentials?: AwsCredentialIdentity
  }
  archiveEnabled: boolean
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} environment variable needs to be set!`)
  }
  return value
}

const port = process.env.PORT || '3000'

// use apiUrl by default, which has less priority over the following cases

let webAppUrl = new URL(
  requireEnv('WEB_APP_URL', process.env.WEB_APP_URL),
).toString()
webAppUrl = webAppUrl.substring(0, webAppUrl.length - 1) // remove trailing slash

let webhookUrl = new URL(
  requireEnv('WEBHOOK_URL', process.env.WEBHOOK_URL),
).toString()
webhookUrl = webhookUrl.substring(0, webhookUrl.length - 1) // remove trailing slash

const appEnv = process.env.APP_ENV || 'development'

const appConfig: AppConfig = {
  port,
  appEnv: appEnv,
  isProd: appEnv === 'prod',
  isDev: appEnv === 'development',
  version: process.env.npm_package_version ?? 'unknown',
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
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  sessionSecretKey: process.env.SESSION_SECRET_KEY || '',
  adminJwtSecretKey: process.env.ADMIN_JWT_SECRET_KEY || '',
  serveWebAppSeparately: process.env.SERVE_WEB_APP_SEPARATELY === 'true',
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  redisUsername: process.env.REDIS_USERNAME,
  redisPassword: process.env.REDIS_PASSWORD,
  redisTls: process.env.REDIS_TLS === 'true',
  redisClusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
  adminUserEmail: requireEnv('ADMIN_USER_EMAIL', process.env.ADMIN_USER_EMAIL),
  enableBullMQDashboard: process.env.ENABLE_BULLMQ_DASHBOARD === 'true',
  s3CommonBucket: requireEnv('S3_COMMON_BUCKET', process.env.S3_COMMON_BUCKET),
  baseUrl: requireEnv('BASE_URL', process.env.BASE_URL),
  webAppUrl,
  webhookUrl,
  requestBodySizeLimit: '1mb',
  isWorker: /worker\.(ts|js)$/.test(require.main?.filename ?? ''),
  workerActionConcurrency: parseInt(
    process.env.WORKER_ACTION_CONCURRENCY || '10',
  ),
  sgid: {
    clientId: requireEnv('SGID_CLIENT_ID', process.env.SGID_CLIENT_ID),
    clientSecret: requireEnv(
      'SGID_CLIENT_SECRET',
      process.env.SGID_CLIENT_SECRET,
    ),
    privateKey: requireEnv('SGID_PRIVATE_KEY', process.env.SGID_PRIVATE_KEY),
  },
  postman: {
    apiKey: requireEnv('POSTMAN_API_KEY', process.env.POSTMAN_API_KEY),
    fromAddress: process.env.POSTMAN_FROM_ADDRESS || 'info@plumber.gov.sg',
    rateLimit: parseInt(process.env.POSTMAN_RATE_LIMIT ?? '') || 169,
  },
  launchDarklySdkKey: requireEnv(
    'LAUNCH_DARKLY_SDK_KEY',
    process.env.LAUNCH_DARKLY_SDK_KEY,
  ),
  maxJobAttempts: Number(process.env.MAX_JOB_ATTEMPTS ?? '10'),
  onboardingEmailWebhookUrl: process.env.ONBOARDING_EMAIL_WEBHOOK_URL || '',
  tilesPostgres: {
    host: process.env.TILES_POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.TILES_POSTGRES_PORT || '5431'),
    username: requireEnv(
      'TILES_POSTGRES_USERNAME',
      process.env.TILES_POSTGRES_USERNAME,
    ),
    password: requireEnv(
      'TILES_POSTGRES_PASSWORD',
      process.env.TILES_POSTGRES_PASSWORD,
    ),
    database: process.env.TILES_POSTGRES_DATABASE || 'plumber_tiles_dev',
    enableSsl: process.env.TILES_POSTGRES_ENABLE_SSL === 'true',
  },
  sso: {
    clientId: requireEnv('SSO_CLIENT_ID', process.env.SSO_CLIENT_ID),
    clientSecret: requireEnv(
      'SSO_CLIENT_SECRET',
      process.env.SSO_CLIENT_SECRET,
    ),
    discoveryUrl: requireEnv(
      'SSO_DISCOVERY_URL',
      process.env.SSO_DISCOVERY_URL,
    ),
  },
  gathersg: {
    publicKey: requireEnv(
      'GATHERSG_PUBLIC_KEY',
      process.env.GATHERSG_PUBLIC_KEY,
    ),
  },
  pair: {
    foundry: {
      apiKey: requireEnv(
        'PAIR_FOUNDRY_API_KEY',
        process.env.PAIR_FOUNDRY_API_KEY,
      ),
      model: requireEnv('PAIR_FOUNDRY_MODEL', process.env.PAIR_FOUNDRY_MODEL),
      imageModel: requireEnv(
        'PAIR_FOUNDRY_IMAGE_MODEL',
        process.env.PAIR_FOUNDRY_IMAGE_MODEL,
      ),
    },
    rome: {
      baseUrl: requireEnv('PAIR_ROME_BASE_URL', process.env.PAIR_ROME_BASE_URL),
      cloudflare: {
        zeroTrustClientKey: requireEnv(
          'PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY',
          process.env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY,
        ),
        zeroTrustSecretKey: requireEnv(
          'PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY',
          process.env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY,
        ),
      },
      aiBuilder: {
        publicKey: requireEnv(
          'PAIR_ROME_AI_BUILDER_PUBLIC_KEY',
          process.env.PAIR_ROME_AI_BUILDER_PUBLIC_KEY,
        ),
        secretKey: requireEnv(
          'PAIR_ROME_AI_BUILDER_SECRET_KEY',
          process.env.PAIR_ROME_AI_BUILDER_SECRET_KEY,
        ),
      },
      pairAction: {
        publicKey: requireEnv(
          'PAIR_ROME_PAIR_ACTION_PUBLIC_KEY',
          process.env.PAIR_ROME_PAIR_ACTION_PUBLIC_KEY,
        ),
        secretKey: requireEnv(
          'PAIR_ROME_PAIR_ACTION_SECRET_KEY',
          process.env.PAIR_ROME_PAIR_ACTION_SECRET_KEY,
        ),
      },
    },
  },
  // AWS postman SES
  ses: {
    fromAddress: process.env.SES_FROM_ADDRESS,
    region: process.env.SES_REGION,
    roleArn: requireEnv('SES_ROLE_ARN', process.env.SES_ROLE_ARN),
    ...(process.env.SES_CONFIGURATION_SET && {
      configurationSet: process.env.SES_CONFIGURATION_SET,
    }),
    ...(process.env.SES_ACCESS_KEY_ID &&
      process.env.SES_SECRET_ACCESS_KEY && {
        credentials: {
          accessKeyId: process.env.SES_ACCESS_KEY_ID,
          secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
        },
      }),
    sqsQueueUrl: process.env.SQS_QUEUE_URL || undefined,
  },
  archiveEnabled: process.env.ARCHIVE_ENABLED === 'true',
}

if (!appConfig.encryptionKey) {
  throw new Error('ENCRYPTION_KEY environment variable needs to be set!')
}

if (!appConfig.sessionSecretKey) {
  throw new Error('SESSION_SECRET_KEY environment variable needs to be set!')
}

if (!appConfig.adminJwtSecretKey) {
  throw new Error('ADMIN_JWT_SECRET_KEY environment variable needs to be set!')
}

if (
  isNaN(appConfig.maxJobAttempts) ||
  !Number.isInteger(appConfig.maxJobAttempts)
) {
  throw new Error(
    'MAX_JOB_ATTEMPTS environment variable is not a valid integer!',
  )
}

// Force SGT date-time formatting no matter what
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

export default appConfig
