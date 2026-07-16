import { IExecutionStep, IGlobalVariable, IJSONObject } from '@plumber/types'

import { COMMON_S3_BUCKET, getObjectFromS3Id } from '@/helpers/s3'
import Flow from '@/models/flow'

export type AttachmentExtensionPolicy =
  | { mode: 'allow'; extensions: readonly string[] }
  | { mode: 'block'; extensions: readonly string[] }

/**
 * Whether an attachment's extension is permitted under the given policy.
 * `allow` mode (Postman): permitted only if the extension is in the list.
 * `block` mode (SES): permitted unless the extension is in the list; a file with
 * no extension is permitted (SES accepts it, and the malware scan still gates).
 */
function isExtensionAllowed(
  fileType: string | undefined,
  policy: AttachmentExtensionPolicy,
): boolean {
  if (!fileType) {
    // No extension: allowed under a block-list (SES), rejected under an allow-list.
    return policy.mode === 'block'
  }
  return policy.mode === 'allow'
    ? policy.extensions.includes(fileType)
    : !policy.extensions.includes(fileType)
}

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
  extensionPolicy,
}: {
  $: IGlobalVariable
  attachmentsList: string[]
  isPartialRetry: boolean
  lastExecutionStep: IExecutionStep | null
  extensionPolicy: AttachmentExtensionPolicy
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
   *
   * All of these are retry behaviours for real executions. Test runs (check
   * step) must never auto-strip: `errorName` there comes from the *previous*
   * check-step run, so without this guard re-clicking "check step" ping-pongs
   * between stripping every attachment and re-including them. `isPartialRetry`
   * is already gated on !testRun; gate the error-name conditions the same way.
   */
  const isRetryWithoutAttachments =
    !$.execution.testRun &&
    (errorName === 'Password-protected attachment(s)' ||
      errorName === 'Unsupported attachment file type' ||
      (isPartialRetry &&
        partialRetryButtonMessage ===
          'Resend to blacklisted recipients without attachments'))

  await Promise.all(
    attachmentsList?.map(async (attachment) => {
      // We verify the flowId here to ensure that the attachment is from the same flow and not
      // maliciously/ manually injected by another user who does not have access to this attachment
      const obj = await getObjectFromS3Id(attachment, { flowId: $.flow.id })
      const fileName = obj.name
      const fileType = obj.name.split('.').pop()?.toLowerCase()

      if (isRetryWithoutAttachments) {
        invalidAttachments.push(fileName)
        return
      }

      if (!isExtensionAllowed(fileType, extensionPolicy)) {
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
