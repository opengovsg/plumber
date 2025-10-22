import { IGlobalVariable } from '@plumber/types'

import crypto from 'crypto'

import logger from '@/helpers/logger'

function getInternalId(data: any) {
  let internalId
  if ('updatedAt' in data) {
    // try to find the updatedAt first
    internalId = `${data.uuid}-${data.updatedAt}`
  } else if ('createdAt' in data) {
    // otherwise fallback to createdAt, for newly created cases
    internalId = `${data.uuid}-${data.createdAt}`
  }
  return internalId
}

/**
 * NOTE: GatherSG may return encrypted data if the encryption key is specified.
 * It is not necessary when the webhook URL is a gov.sg URL,
 * but is necessary for local development where we use our own tunnel for the webhook.
 *
 * At this point, Plumber will only support encrypted data for local development.
 */
export async function decryptResponse(
  $: IGlobalVariable,
): Promise<{ verified: boolean; internalId: string | null }> {
  try {
    const { app, data, encryptedData, signature, timestamp } = $.request.body
    const { encryptionKey } = $.step.parameters

    if (encryptedData && encryptionKey) {
      const input = Buffer.from(encryptedData, 'base64')
      const iv = input.subarray(0, 16)
      const cipherText = input.subarray(16)
      const cipherKey = crypto
        .createHash('sha256')
        .update(encryptionKey as string)
        .digest()

      const decipher = crypto.createDecipheriv('aes-256-ctr', cipherKey, iv)
      const decryptedStr = Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
      ]).toString()
      const decryptedData = JSON.parse(decryptedStr)

      $.request.body = {
        app,
        data: decryptedData,
        signature,
        timestamp,
      }

      return {
        verified: true,
        internalId: getInternalId(decryptedData),
      }
    } else {
      return {
        verified: true,
        internalId: getInternalId(data),
      }
    }
  } catch (err) {
    logger.error('Unable to decrypt gathersg response', { error: err })
    return { verified: false, internalId: null }
  }
}
