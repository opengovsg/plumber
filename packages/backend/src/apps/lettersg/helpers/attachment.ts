import { type IGlobalVariable } from '@plumber/types'

import { COMMON_S3_BUCKET, putObject } from '@/helpers/s3'

export async function downloadAndStoreAttachmentInS3(
  $: IGlobalVariable,
  publicId: string,
  templateName: string,
): Promise<string> {
  // Note: no try catch because no known error found yet: will still throw general error
  // separated the two http calls to avoid confusion
  // Letters provide a redirect link so axios will auto-download it after redirecting
  // Potential TODO (mal): allow people to rename the file
  const { data: pdfData } = await $.http.get('/v1/letters/:publicId/pdfs', {
    responseType: 'arraybuffer',
    urlPathParams: {
      publicId,
    },
    headers: {
      Accept: 'application/pdf',
    },
  })

  const objectKey = `${$.execution.id}/${$.step.appKey}/${publicId}/${templateName}.pdf`
  return await putObject(COMMON_S3_BUCKET, objectKey, pdfData, {
    flowId: $.flow.id,
    stepId: $.step.id,
    executionId: $.execution.id ?? '', // Empty = test runs
    publicId,
  })
}
