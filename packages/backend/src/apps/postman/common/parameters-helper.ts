import { IGlobalVariable } from '@plumber/types'

import { COMMON_S3_BUCKET, getObjectFromS3Id } from '@/helpers/s3'
import Flow from '@/models/flow'

import { POSTMAN_ACCEPTED_EXTENSIONS } from './constants'

export async function getDefaultReplyTo(flowId: string): Promise<string> {
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphFetched({ user: true })
    .throwIfNotFound()
  return flow.user.email
}

export async function filterAttachments(
  attachmentsList: string[],
  $: IGlobalVariable,
) {
  let submissionId: string | null = null
  const invalidAttachments: string[] = []
  const attachmentFiles: { fileName: string; data: Uint8Array }[] = []

  await Promise.all(
    attachmentsList?.map(async (attachment) => {
      // We verify the flowId here to ensure that the attachment is from the same flow and not
      // maliciously/ manually injected by another user who does not have access to this attachment
      const obj = await getObjectFromS3Id(attachment, { flowId: $.flow.id }, $)
      const fileName = obj.name
      const fileType = obj.name.split('.').pop()?.toLowerCase()
      if (!fileType || !POSTMAN_ACCEPTED_EXTENSIONS.includes(fileType)) {
        invalidAttachments.push(fileName)

        if (submissionId === null) {
          submissionId = attachment.slice(
            `s3:${COMMON_S3_BUCKET}:`.length,
            attachment.indexOf('/', `s3:${COMMON_S3_BUCKET}:`.length),
          )
        }
      } else {
        attachmentFiles.push({ fileName, data: obj.data })
      }
      return
    }),
  )
  return { attachmentFiles, invalidAttachments, submissionId }
}
