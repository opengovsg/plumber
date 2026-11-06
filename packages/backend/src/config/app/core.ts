import '@/config/datetime'
import './load-app-env'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

import type { AwsCredentialIdentity } from '@aws-sdk/types'
import { posthogHost, posthogProjectToken } from '@plumber/shared'
import { z } from 'zod'

import { requireEnv } from './require-env'

// IMPORTANT: ECS runs `node` directly, so npm_package_version is unset there.
const getVersion = (): string =>
  process.env.npm_package_version ??
  z
    .object({ version: z.string() })
    .parse(
      JSON.parse(
        readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
      ),
    ).version

export type CoreConfig = {
  port: string
  webAppUrl: string
  webhookUrl: string
  version: string
  baseUrl: string
  encryptionKey: string
  sessionSecretKey: string
  adminJwtSecretKey: string
  serveWebAppSeparately: boolean
  enableBullMQDashboard: boolean
  s3CommonBucket: string
  adminUserEmail: string
  requestBodySizeLimit: string
  posthog: {
    projectToken: string
    host: string
  }
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
    privateKeyPem: string
    issuer: string
  }
  gathersg: {
    publicKey: string
  }
  bedrock: {
    region: string
    model: string
    imageModel: string
    fallbackModel: string
    /**
     * Local dev only. Deployed environments authenticate with the ECS task role.
     */
    devApiKey?: string
  }
  pair: {
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
  templateDescription: {
    apiKey?: string
    model: string
  }
  archiveEnabled: boolean
  aiGateway: {
    apiKey?: string
  }
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

const coreConfig: CoreConfig = {
  templateDescription: {
    apiKey: process.env.AI_GATEWAY_API_KEY,
    model: process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini',
  },
  port,
  version: getVersion(),
  baseUrl: requireEnv('BASE_URL', process.env.BASE_URL),
  webAppUrl,
  webhookUrl,
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  sessionSecretKey: process.env.SESSION_SECRET_KEY || '',
  adminJwtSecretKey: process.env.ADMIN_JWT_SECRET_KEY || '',
  serveWebAppSeparately: process.env.SERVE_WEB_APP_SEPARATELY === 'true',
  adminUserEmail: requireEnv('ADMIN_USER_EMAIL', process.env.ADMIN_USER_EMAIL),
  enableBullMQDashboard: process.env.ENABLE_BULLMQ_DASHBOARD === 'true',
  s3CommonBucket: requireEnv('S3_COMMON_BUCKET', process.env.S3_COMMON_BUCKET),
  requestBodySizeLimit: '1mb',
  posthog: {
    projectToken: posthogProjectToken,
    host: posthogHost,
  },
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
    // Secret managers often store the PEM single-line with literal "\n".
    privateKeyPem: requireEnv(
      'SSO_PRIVATE_KEY_PEM',
      process.env.SSO_PRIVATE_KEY_PEM,
    ).replace(/\\n/g, '\n'),
    issuer: requireEnv('SSO_ISSUER', process.env.SSO_ISSUER).replace(/\/$/, ''),
  },
  gathersg: {
    publicKey: requireEnv(
      'GATHERSG_PUBLIC_KEY',
      process.env.GATHERSG_PUBLIC_KEY,
    ),
  },
  bedrock: {
    region: requireEnv('BEDROCK_REGION', process.env.BEDROCK_REGION),
    model: requireEnv('BEDROCK_MODEL', process.env.BEDROCK_MODEL),
    imageModel: requireEnv(
      'BEDROCK_IMAGE_MODEL',
      process.env.BEDROCK_IMAGE_MODEL,
    ),
    fallbackModel: requireEnv(
      'BEDROCK_FALLBACK_MODEL',
      process.env.BEDROCK_FALLBACK_MODEL,
    ),
    devApiKey: process.env.BEDROCK_API_KEY,
  },
  pair: {
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
  aiGateway: {
    apiKey: process.env.AI_GATEWAY_API_KEY || undefined,
  },
}

if (!coreConfig.encryptionKey) {
  throw new Error('ENCRYPTION_KEY environment variable needs to be set!')
}

if (!coreConfig.sessionSecretKey) {
  throw new Error('SESSION_SECRET_KEY environment variable needs to be set!')
}

if (!coreConfig.adminJwtSecretKey) {
  throw new Error('ADMIN_JWT_SECRET_KEY environment variable needs to be set!')
}

if (
  isNaN(coreConfig.maxJobAttempts) ||
  !Number.isInteger(coreConfig.maxJobAttempts)
) {
  throw new Error(
    'MAX_JOB_ATTEMPTS environment variable is not a valid integer!',
  )
}

export default coreConfig
