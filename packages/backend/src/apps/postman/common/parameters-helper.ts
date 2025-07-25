import { IGlobalVariable } from '@plumber/types'

import { COMMON_S3_BUCKET, getObjectFromS3Id } from '@/helpers/s3'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'

import { POSTMAN_ACCEPTED_EXTENSIONS } from './constants'

export async function getDefaultReplyTo(flowId: string): Promise<string> {
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphFetched({ user: true })
    .throwIfNotFound()
  return flow.user.email
}

export async function getFormId(executionId: string): Promise<string | null> {
  const formData = await ExecutionStep.query()
    .where('execution_id', executionId)
    .where('app_key', 'formsg')
    .first()
    .select('data_out')

  const formId = formData?.dataOut?.formId
  return formId ? String(formId) : null
}

export async function filterAttachments(
  attachmentsList: string[],
  $: IGlobalVariable,
) {
  let formId: string | null = null
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

        if (formId === null) {
          formId = await getFormId($.execution.id)
        }

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
  return { attachmentFiles, invalidAttachments, submissionId, formId }
}
