import { FormField } from '@opengovsg/formsg-sdk'
import { DecryptedAttachments } from '@opengovsg/formsg-sdk/dist/types'
import axios from 'axios'

import logger from '@/helpers/logger'

import { getSdk } from '../common/form-env'

/**
 * Decrypts form attachments from presigned S3 download URLs.
 *
 * Works for both v3- and v4-shaped MRF submissions: attachments are
 * encrypted the same way in both, with only the decrypted response shape
 * differing (and that is handled upstream by processResponsesV3/V4).
 *
 * @param formSgSdk - The FormSG SDK instance
 * @param submissionSecretKey - The decrypted submission secret key (base64)
 * @param attachmentDownloadUrls - Map of field ID to presigned S3 download URL
 * @param formFields - All decrypted form fields - it will be filtered to attachment fields only later
 */
export async function decryptFormAttachmentsV3OrV4(
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
        const {
          data: { encryptedFile },
        } = await axios.get(url, {
          responseType: 'json',
        })

        const decryptedBinary = await formSgSdk.cryptoV3.decryptFile(
          submissionSecretKey,
          // Reverse engineered from convertEncryptedAttachmentToFileContent
          // until the official SDK releases the decryptAttachmentV4 function.
          {
            submissionPublicKey: encryptedFile.submissionPublicKey,
            nonce: encryptedFile.nonce,
            binary: new Uint8Array(Buffer.from(encryptedFile.binary, 'base64')),
          },
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
