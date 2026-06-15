import { IGlobalVariable, IJSONValue } from '@plumber/types'

import axios from 'axios'
import FormData from 'form-data'
import { z } from 'zod'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import {
  COMMON_S3_BUCKET,
  getObjectFromS3Id,
  MAX_FILE_SIZE,
  putObject,
} from '@/helpers/s3'

import { GATHER_FILE_API_UPLOAD_URL } from './constants'

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

export interface GatherUploadedFile {
  uuid: string
  name: string
  mimeType: string
  size: number
  expireAt: string
}

/**
 * Step 1 of the upload handshake: mint a per-field upload token via the CMS API
 * (x-api-key + CMS base through the addAuthHeader beforeRequest hook).
 */
export async function generateUploadToken(
  $: IGlobalVariable,
  { field, type, caseUuid }: { field: string; type: string; caseUuid: string },
): Promise<string> {
  const { data } = await $.http.post<{ data: { token: string } }>(
    '/cases/upload/token',
    { field, type, uuid: caseUuid },
  )
  return data.data.token
}

/**
 * Step 2 of the upload handshake: upload one file to the File API with the
 * bearer token. Uses a standalone axios call because the File API has a
 * different base + Bearer auth than the app's $.http client.
 */
export async function uploadFileToGather(
  token: string,
  file: { name: string; data: Uint8Array },
): Promise<GatherUploadedFile> {
  const form = new FormData()
  form.append('file', Buffer.from(file.data), file.name)

  try {
    const { data } = await axios.post<{ data: GatherUploadedFile }>(
      GATHER_FILE_API_UPLOAD_URL,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        // Disable axios' default body-size guard; per-file size is already
        // bounded by MAX_FILE_SIZE before we reach this point.
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    )
    return data.data
  } catch (error) {
    // Normalize to HttpError so the action's catch can map it consistently.
    throw new HttpError(error)
  }
}

/**
 * Upload the files for one target attachment field: fetch each file from S3
 * (flow-ownership + virus-scan enforced by getObjectFromS3Id), enforce the
 * shared MAX_FILE_SIZE, mint a single token for the field, upload each file,
 * and return the resulting file uuids in order.
 */
export async function uploadCaseAttachments({
  $,
  caseUuid,
  field,
  fieldType,
  s3Ids,
}: {
  $: IGlobalVariable
  caseUuid: string
  field: string
  fieldType: string
  s3Ids: string[]
}): Promise<string[]> {
  if (!s3Ids.length) {
    return []
  }

  const files = await Promise.all(
    s3Ids.map(async (s3Id) => {
      const obj = await getObjectFromS3Id(s3Id, { flowId: $.flow.id })
      if (obj.data.byteLength > MAX_FILE_SIZE) {
        const sizeText = MAX_FILE_SIZE / (1024 * 1024)
        throw new StepError(
          `Attachment ${obj.name} exceeds maximum size of ${sizeText}MB`,
          `Please check that your case attachments do not exceed ${sizeText}MB.`,
        )
      }
      return obj
    }),
  )

  // One token is minted per field and reused for all of that field's files
  // (the upload API accepts multiple files per token). Confirm against the
  // live API if multi-file uploads to a single field ever start failing.
  const token = await generateUploadToken($, {
    field,
    type: fieldType,
    caseUuid,
  })

  const uuids: string[] = []
  // Upload sequentially to avoid concurrent uploads racing on the same token.
  for (const file of files) {
    const uploaded = await uploadFileToGather(token, file)
    uuids.push(uploaded.uuid)
  }
  return uuids
}
