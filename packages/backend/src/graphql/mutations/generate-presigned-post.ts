import { PresignedPost } from '@aws-sdk/s3-presigned-post'
import { randomUUID } from 'crypto'

import { ForbiddenError } from '@/errors/graphql-errors'
import {
  COMMON_S3_BUCKET,
  getPresignedPost,
  MAX_FILE_SIZE,
  SES_BLOCKED_EXTENSIONS,
  validateObjectKey,
} from '@/helpers/s3'

import { MutationResolvers } from '../__generated__/types.generated'

const generatePresignedPost: MutationResolvers['generatePresignedPost'] =
  async (_parent, params, context) => {
    const {
      flow: flowInput,
      filename,
      fileType,
      size,
      updatedAt,
    } = params.input

    if (size > MAX_FILE_SIZE) {
      throw new Error('Size of attachment exceeds 10MB')
    }
    // Block-list gate: accept anything except executables/scripts (mirrors the
    // SES send-time filter). Extension-based to match how attachments are
    // actually filtered on send; the reported MIME type is unreliable and only
    // used for the S3 object's content type. Files with no extension are allowed
    // (consistent with filterAttachments); every object is malware-scanned.
    const parts = filename.split('.')
    const fileExtension =
      parts.length > 1 ? parts.pop()?.toLowerCase() : undefined
    if (fileExtension && SES_BLOCKED_EXTENSIONS.includes(fileExtension)) {
      throw new Error('Unsupported file type')
    }

    const uuid = randomUUID()
    const objectKey = `${flowInput.id}/${uuid}/${filename}`
    if (!validateObjectKey(objectKey)) {
      throw new Error('File path cannot be longer than 1024 bytes')
    }

    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'editor' })
      .findOne({ id: flowInput.id })

    if (!flow) {
      throw new ForbiddenError(
        'You do not have sufficient permissions for this pipe',
      )
    }

    flow.assertNotUpdatedSince(flowInput.updatedAt, context.currentUser.id)

    const presignedPost = await getPresignedPost(
      COMMON_S3_BUCKET,
      objectKey,
      fileType,
      {
        flowId: flowInput.id,
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
