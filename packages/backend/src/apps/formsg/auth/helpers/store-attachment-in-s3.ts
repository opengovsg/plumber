import { IGlobalVariable } from '@plumber/types'

import {
  DecryptedAttachments,
  FormField,
} from '@opengovsg/formsg-sdk/dist/types'

import appConfig from '@/config/app'
import { putObject } from '@/helpers/plumber-s3'

const s3Bucket = `plumber-${appConfig.appEnv}-attachment-bucket`

/**
 * If a field has an associated attachment, stores that attachment on our S3.
 *
 * **Note**
 * For simplicity, this uploads attachments synchronously on our web tier. But
 * this means it's a (potentially) expensive function for submissions with many
 * attachments.
 *
 * If we need to scale more, we can:
 * 1. Use AWS lambdas to upload.
 * 2. Shift validation & trigger processing into our worker tier instead.
 *
 * @returns Plumber S3 URN representing the attachment.
 */
async function storeAttachmentInS3(
  $: Readonly<IGlobalVariable>,
  submissionId: string,
  formField: Readonly<FormField>,
  attachments: Readonly<DecryptedAttachments> | null,
): Promise<string> {
  const attachment = attachments[formField._id]
  if (!attachment) {
    return ''
  }

  return await putObject(
    s3Bucket,
    `${submissionId}/${formField._id}/${attachment.filename}`,
    attachment.content,
    {
      flowId: $.flow.id,
      stepId: $.step.id,
      executionId: $.execution.id ?? '', // Empty = test runs.
      formId: $.auth.data.formId as string,
    },
  )
}

export default storeAttachmentInS3
