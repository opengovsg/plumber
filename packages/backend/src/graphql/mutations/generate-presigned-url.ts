import { randomUUID } from 'crypto'

import appConfig from '@/config/app'
import {
  COMMON_S3_BUCKET,
  getPresignedPost,
  getPresignedUrl,
} from '@/helpers/s3'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

const generatePresignedUrl: MutationResolvers['generatePresignedUrl'] = async (
  _parent,
  params,
  context,
) => {
  const { id, filename, fileType, size, updatedAt, manualUpload } = params.input

  await Flow.hasAccess(context.currentUser.id, id)

  const uuid = randomUUID()
  const filePath = `${id}/${uuid}/${filename}`
  const url = await getPresignedUrl(COMMON_S3_BUCKET, filePath, fileType, {
    flowId: id,
    filename,
    size: size.toString(),
    updatedAt,
    manualUpload: manualUpload.toString(),
  })

  const customUrl = url.replace(
    new RegExp(
      `https://${COMMON_S3_BUCKET}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com`,
    ),
    `https://upload-${appConfig.appEnv}.plumber.gov.sg`,
  )

  return { url: customUrl, s3Id: `s3:${COMMON_S3_BUCKET}:${filePath}` }
}

export default generatePresignedUrl

export const generatePresignedPost: MutationResolvers['generatePresignedPost'] =
  async (_parent, params) => {
    const { id, filename, fileType, size, updatedAt, manualUpload } =
      params.input
    const uuid = randomUUID()
    const filePath = `${id}/${uuid}/${filename}`
    const { fields } = await getPresignedPost(
      COMMON_S3_BUCKET,
      filePath,
      fileType,
      {
        flowId: id,
        filename,
        size: size.toString(),
        updatedAt,
        manualUpload: manualUpload.toString(),
      },
    )

    return {
      url: appConfig.s3UploadUrl,
      fields,
      s3Id: `s3:${COMMON_S3_BUCKET}:${filePath}`,
    }
  }
