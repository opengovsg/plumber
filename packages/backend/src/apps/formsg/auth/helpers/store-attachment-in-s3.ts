import { IGlobalVariable } from '@plumber/types'

import {
  DecryptedAttachments,
  FormField,
} from '@opengovsg/formsg-sdk/dist/types'

import {
  ATTACHMENT_TYPE,
  buildAttachmentTypeTagging,
  COMMON_S3_BUCKET,
  putObject,
} from '@/helpers/s3'

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
 * @returns S3 ID representing the attachment.
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

  return await putObject({
    bucket: COMMON_S3_BUCKET,
    objectKey: `${submissionId}/${formField._id}/${attachment.filename}`,
    body: attachment.content,
    metadata: {
      flowId: $.flow.id,
      stepId: $.step.id,
      executionId: $.execution.id ?? '',
      formId: $.auth.data.formId as string,
    },
    tagging: buildAttachmentTypeTagging(
      $.flow.isActive ? ATTACHMENT_TYPE.TRANSITIVE : ATTACHMENT_TYPE.TEST,
    ),
  })
}

export default storeAttachmentInS3
