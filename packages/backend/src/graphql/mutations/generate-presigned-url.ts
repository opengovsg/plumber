import { randomUUID } from 'crypto'

import { COMMON_S3_BUCKET, getPresignedUrl } from '@/helpers/s3'
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

  return { url, s3Id: `s3:${COMMON_S3_BUCKET}:${filePath}` }
}

export default generatePresignedUrl
