import { IGlobalVariable, IJSONValue } from '@plumber/types'
import { z } from 'zod'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import { COMMON_S3_BUCKET, MAX_FILE_SIZE, putObject } from '@/helpers/s3'

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
type EnrichedAttachment = ParsedAttachment & { s3Id: string }
export type ProcessedAttachment = EnrichedAttachment & {
  attachmentUuid: string
}

async function downloadAndStoreAttachmentInS3(
  $: IGlobalVariable,
  caseUuid: IJSONValue,
  attachmentUuid: string,
  attachment: ParsedAttachment,
): Promise<string> {
  try {
    // NOTE: there should not be any instance where there is no execution id
    // we skip saving attachments if there is no execution id as it becomes useless
    if (!$.execution.id) {
      logger.error(
        `Failed to process attachment ${attachmentUuid} for case ${caseUuid}:`,
        'Missing execution id',
      )
      throw new Error('Failed to store attachments')
    }

    const filename = attachment.name

    if (attachment.size > MAX_FILE_SIZE) {
      const sizeText = MAX_FILE_SIZE / (1024 * 1024)
      throw new StepError(
        `Attachment ${filename} exceeds maximum size of ${sizeText}MB`,
        `Please check that your case attachments do not exceed ${sizeText}MB.`,
      )
    }

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

    const objectKey = `${$.execution.id}/${$.step.appKey}/${String(
      caseUuid,
    )}/${attachmentUuid}/${filename}`

    const s3Id = await putObject({
      bucket: COMMON_S3_BUCKET,
      objectKey,
      body: attachmentBinary,
      metadata: {
        flowId: String($.flow.id),
        stepId: String($.step.id),
        executionId: String($.execution.id),
        caseUuid: String(caseUuid),
        attachmentUuid,
      },
    })

    return s3Id
  } catch (error) {
    logger.error(
      `Failed to process attachment ${attachmentUuid} for case ${caseUuid}:`,
      error,
    )

    if (error instanceof StepError) {
      throw error
    }

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
  attachments: Record<string, unknown>,
): Promise<ProcessedAttachment[]> {
  if (!attachments) {
    return []
  }

  const parsedAttachments = attachmentsSchema.safeParse(attachments)

  if (!parsedAttachments.success) {
    throw new StepError(
      `Invalid attachments: ${parsedAttachments.error.message}`,
      'Please check that your case attachments are accessible and try again.',
    )
  }

  return Promise.all(
    Object.entries(parsedAttachments.data).map(
      async ([attachmentUuid, attachment]) => {
        const s3Id = await downloadAndStoreAttachmentInS3(
          $,
          caseUuid,
          attachmentUuid,
          attachment,
        )

        return { attachmentUuid, ...attachment, s3Id }
      },
    ),
  )
}
