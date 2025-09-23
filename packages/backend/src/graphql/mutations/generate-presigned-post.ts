import { PresignedPost } from '@aws-sdk/s3-presigned-post'
import { randomUUID } from 'crypto'

import {
  ACCEPTED_FILE_TYPES,
  COMMON_S3_BUCKET,
  getPresignedPost,
  MAX_FILE_SIZE,
  validateObjectKey,
} from '@/helpers/s3'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

const generatePresignedPost: MutationResolvers['generatePresignedPost'] =
  async (_parent, params, context) => {
    const { flowId, filename, fileType, size, updatedAt } = params.input

    if (size > MAX_FILE_SIZE) {
      throw new Error('Size of attachment exceeds 10MB')
    }
    if (!ACCEPTED_FILE_TYPES.includes(fileType)) {
      throw new Error('Unsupported file type')
    }

    const uuid = randomUUID()
    const objectKey = `${flowId}/${uuid}/${filename}`
    if (!validateObjectKey(objectKey)) {
      throw new Error('File path cannot be longer than 1024 bytes')
    }

    await Flow.hasAccess(context.currentUser.id, flowId)

    const presignedPost = await getPresignedPost(
      COMMON_S3_BUCKET,
      objectKey,
      fileType,
      {
        flowId,
        filename,
        size: size.toString(),
        updatedAt,
      },
    )

    return {
      presignedPost: presignedPost as PresignedPost,
      s3Id: `s3:${COMMON_S3_BUCKET}:${objectKey}`,
    }
  }

export default generatePresignedPost
