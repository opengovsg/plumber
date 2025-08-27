import { IExecutionStep, IGlobalVariable, IJSONObject } from '@plumber/types'

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

export async function filterAttachments({
  $,
  attachmentsList,
  isPartialRetry,
  lastExecutionStep,
}: {
  $: IGlobalVariable
  attachmentsList: string[]
  isPartialRetry: boolean
  lastExecutionStep: IExecutionStep | null
}) {
  let submissionId: string | null = null
  const invalidAttachments: string[] = []
  const attachmentFiles: { fileName: string; data: Uint8Array }[] = []

  const errorName = lastExecutionStep?.errorDetails?.name
  const partialRetryButtonMessage = (
    lastExecutionStep?.errorDetails?.partialRetry as IJSONObject
  )?.buttonMessage

  /**
   * NOTE: there are different scenarios where we should retry without attachments:
   * 1. Password-protected attachment(s)
   *    Postman does not tell us reliably which attachment(s) are password-protected
   *    so we remove all attachments instead.
   *
   * 2. Unsupported attachment file type
   *    This is the old error code that is thrown when there are unsupported or password-protected attachments.
   *    We remove all attachments when retrying old executions to avoid having to retry twice in the event
   *    that there are password-protected attachments, which will cause another failure.
   *
   * 3. isPartialRetry and Resend to blacklisted recipients without attachments
   *    This is to handle executions that failed due to invalid attachments and had blacklisted recipients.
   *    Upon retry, the execution runs without attachments, but the blacklisted recipient still exists.
   *    In such scenarios, we show the partial retry button with 'Resend to blacklisted recipients without attachments',
   *    and use this to tell the worker to remove all attachments.
   */
  const isRetryWithoutAttachments =
    errorName === 'Password-protected attachment(s)' ||
    errorName === 'Unsupported attachment file type' ||
    (isPartialRetry &&
      partialRetryButtonMessage ===
        'Resend to blacklisted recipients without attachments')

  await Promise.all(
    attachmentsList?.map(async (attachment) => {
      // We verify the flowId here to ensure that the attachment is from the same flow and not
      // maliciously/ manually injected by another user who does not have access to this attachment
      const obj = await getObjectFromS3Id(attachment, { flowId: $.flow.id }, $)
      const fileName = obj.name
      const fileType = obj.name.split('.').pop()?.toLowerCase()

      if (isRetryWithoutAttachments) {
        invalidAttachments.push(fileName)
        return
      }

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

  if (isRetryWithoutAttachments) {
    return {
      attachmentFiles: [],
      invalidAttachments,
      submissionId,
      isRetryWithoutAttachments,
    }
  }

  return {
    attachmentFiles,
    invalidAttachments,
    submissionId,
    isRetryWithoutAttachments,
  }
}
