import { IGlobalVariable } from '@plumber/types'

import axios from 'axios'

import { COMMON_S3_BUCKET, putObject } from '@/helpers/s3'

export async function getPresignedUrl(
  $: IGlobalVariable,
  publicId: string,
): Promise<string> {
  const { data } = await $.http.post(`/v1/letters/${publicId}/pdfs`)
  return data.presignedUrl
}

export async function downloadAndStoreAttachmentInS3(
  $: IGlobalVariable,
  publicId: string,
): Promise<string> {
  // Note: no try catch because no known error found yet: will still throw general error
  // separated the two http calls to avoid confusion
  const { data: pdfData } = await axios.get(
    await getPresignedUrl($, publicId),
    {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
      },
    },
  )

  // objectKey: `${publicId}/letter`,
  return await putObject(COMMON_S3_BUCKET, `${publicId}/letter.pdf`, pdfData, {
    flowId: $.flow.id,
    stepId: $.step.id,
    executionId: $.execution.id ?? '', // Empty = test runs
    publicId,
  })
}
