import {
  DecryptedAttachments,
  FormField,
} from '@opengovsg/formsg-sdk/dist/types'
import {
  convertEncryptedAttachmentToFileContent,
  decryptContent,
} from '@opengovsg/formsg-sdk/dist/util/crypto'
import axios from 'axios'

import logger from '@/helpers/logger'

import { getSdk } from '../common/form-env'

export function decryptSubmissionSecretKey(
  formSecretKey: string,
  encryptedSubmissionSecretKey: string,
): string | null {
  const decrypted = decryptContent(formSecretKey, encryptedSubmissionSecretKey)
  if (!decrypted) {
    return null
  }
  return Buffer.from(decrypted).toString('base64')
}

/**
 * Decrypts V3 form attachments from presigned S3 download URLs.
 *
 * @param formSgSdk - The FormSG SDK instance
 * @param submissionSecretKey - The decrypted submission secret key (base64)
 * @param attachmentDownloadUrls - Map of field ID to presigned S3 download URL
 * @param formFields - All decrypted form fields - it will be filtered to attachment fields only later
 */
export async function decryptFormAttachmentsV3(
  formSgSdk: ReturnType<typeof getSdk>,
  submissionSecretKey: string,
  attachmentDownloadUrls: Record<string, string>,
  formFields: FormField[],
): Promise<DecryptedAttachments> {
  if (Object.keys(attachmentDownloadUrls).length === 0) {
    return {}
  }

  const decryptedAttachments: DecryptedAttachments = {}

  const filenames = formFields.reduce((acc, field) => {
    if (field.fieldType === 'attachment') {
      acc[field._id] = field.answer
    }
    return acc
  }, {} as Record<string, string>)

  await Promise.all(
    Object.entries(attachmentDownloadUrls).map(async ([fieldId, url]) => {
      try {
        const { data: downloadResponse } = await axios.get(url, {
          responseType: 'json',
        })

        const encryptedFile =
          convertEncryptedAttachmentToFileContent(downloadResponse)
        const decryptedBinary = await formSgSdk.cryptoV3.decryptFile(
          submissionSecretKey,
          encryptedFile,
        )

        if (!decryptedBinary) {
          logger.error({
            event: 'formsg-v3-attachment-decrypt-binary-failed',
            fieldId,
          })
          throw new Error('Failed to decrypt V3 attachment binary')
        }

        decryptedAttachments[fieldId] = {
          filename: filenames[fieldId] ?? fieldId,
          content: decryptedBinary,
        }
      } catch (err) {
        logger.error({
          event: 'formsg-v3-attachment-error',
          fieldId,
          error: err,
        })
        throw 'Error downloading or decrypting V3 attachment'
      }
    }),
  )

  return decryptedAttachments
}
