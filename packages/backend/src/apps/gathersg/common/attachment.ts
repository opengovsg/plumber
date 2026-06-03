import { IGlobalVariable, IJSONValue } from '@plumber/types'

import { z } from 'zod'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import { COMMON_S3_BUCKET, putObject } from '@/helpers/s3'

export const attachmentsSchema = z.record(
  z.string(),
  z.object({
    name: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number(),
    s3Id: z.string().min(1).optional(),
  }),
)
type ParsedAttachment = z.infer<typeof attachmentsSchema>[string]

async function downloadAndStoreAttachmentInS3(
  $: IGlobalVariable,
  caseUuid: IJSONValue,
  attachmentUuid: string,
  attachment: ParsedAttachment,
): Promise<string> {
  try {
    const { data: attachmentBinary } = await $.http.get(
      '/cases/:caseUuid/attachments/:attachmentUuid',
      {
        responseType: 'arraybuffer',
        urlPathParams: {
          caseUuid,
          attachmentUuid,
        },
      },
    )

    const filename =
      typeof attachment.name === 'string' && attachment.name.length > 0
        ? attachment.name
        : attachmentUuid

    const objectKey = `${$.execution.id}/${$.step.appKey}/${String(
      caseUuid,
    )}/${attachmentUuid}/${filename}`

    const s3Id = await putObject(
      COMMON_S3_BUCKET,
      objectKey,
      attachmentBinary,
      {
        flowId: String($.flow.id),
        stepId: String($.step.id),
        executionId: $.execution.id !== undefined ? String($.execution.id) : '',
        caseUuid: String(caseUuid),
        attachmentUuid,
        filename,
      },
    )

    return s3Id
  } catch (error) {
    logger.error(
      `Failed to process attachment ${attachmentUuid} for case ${caseUuid}:`,
      error,
    )
    throw new StepError(
      `Failed to process attachment ${attachmentUuid} for case ${caseUuid}`,
      'Please check that your case attachments are accessible and try again.',
      error,
    )
  }
}

export async function processAttachments(
  $: IGlobalVariable,
  caseUuid: IJSONValue,
  attachments: Record<string, any>,
): Promise<Record<string, any>> {
  if (!attachments) {
    return {}
  }

  let processedAttachments = {}
  const parsedAttachments = attachmentsSchema.safeParse(attachments)

  if (!parsedAttachments.success) {
    throw new StepError(
      `Invalid attachments: ${parsedAttachments.error.message}`,
      'Please check that your case attachments are accessible and try again.',
    )
  }
  const attachmentEntries = await Promise.all(
    Object.entries(parsedAttachments.data).map(
      async ([attachmentUuid, attachment]) => {
        const s3Id = await downloadAndStoreAttachmentInS3(
          $,
          caseUuid,
          attachmentUuid,
          attachment,
        )

        return [attachmentUuid, { ...attachment, s3Id }] as const
      },
    ),
  )

  processedAttachments = Object.fromEntries(attachmentEntries)

  return processedAttachments
}
