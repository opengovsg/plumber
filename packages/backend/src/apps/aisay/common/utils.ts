import { SafeParseError, SafeParseReturnType } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { getObjectFromS3Id } from '@/helpers/s3'

export const uint8ArrayToBase64 = (uint8Array: Uint8Array) => {
  return Buffer.from(uint8Array).toString('base64')
}

export const getAttachmentFromS3 = async (
  attachment: string,
  flowId: string,
) => {
  const obj = await getObjectFromS3Id(attachment, { flowId })
  return { fileName: obj.name, data: uint8ArrayToBase64(obj.data) }
}

export const getValidationError = (
  result: SafeParseReturnType<unknown, unknown>,
) => {
  const validationError = fromZodError(
    (result as SafeParseError<unknown>).error,
  )

  const fieldName = validationError.details[0].path[0]
  const stepErrorName = validationError.details[0].message
  const isAttachmentNotStoredError =
    fieldName === 'attachments' && stepErrorName.includes('not a S3 ID')
  const stepErrorSolution = isAttachmentNotStoredError
    ? 'This attachment was not stored in the last submission. Please make a new submission with attachments to successfully configure this pipe.'
    : 'Reconfigure the invalid field and try again.'

  return { stepErrorName, stepErrorSolution }
}
