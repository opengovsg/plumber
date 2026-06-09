import { S3Client } from '@aws-sdk/client-s3'

import { archivalConfig } from './config'

export const archiveS3Client = new S3Client({
  region: 'ap-southeast-1',
  ...(archivalConfig.isDev && {
    credentials: {
      accessKeyId: archivalConfig.s3AccessKey ?? '',
      secretAccessKey: archivalConfig.s3SecretKey ?? '',
    },
    endpoint: archivalConfig.s3Endpoint,
    forcePathStyle: true,
  }),
})
