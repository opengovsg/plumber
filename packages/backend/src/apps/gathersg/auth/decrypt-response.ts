import { IGlobalVariable } from '@plumber/types'

import crypto from 'crypto'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'

import { HEX_ENCODED_FIELD_PREFIX } from '../common/constants'

import schema from './schema'

function getInternalId(data: any) {
  if (data?.updatedAt) {
    // try to find the updatedAt first
    return `${data?.uuid}-${data.updatedAt}`
  } else if (data?.createdAt) {
    // otherwise fallback to createdAt, for newly created cases
    return `${data?.uuid}-${data.createdAt}`
  }
  return ''
}

function validateData(data: any, flowId: string, app: string) {
  const validationResult = schema.safeParse(data)
  if (!validationResult.success) {
    logger.error(
      `GatherSG: potential infinite loop! Webhook not triggered by user! flowId: ${flowId}. app: ${app}. case type: ${data?.type}. case uuid: ${data?.uuid}`,
    )
    throw new Error(
      'GatherSG: potential infinite loop! Webhook not triggered by user!',
    )
  }
  return validationResult.data
}

export function processFields(fields: Record<string, any>) {
  const processedFields: Record<string, any> = {}
  const invalidCharRegex = /[^a-zA-Z0-9-_ ]/
  for (const [key, value] of Object.entries(fields)) {
    if (invalidCharRegex.test(key)) {
      const hexKey = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(key).toString(
        'hex',
      )}`
      processedFields[hexKey] = value
    } else {
      processedFields[key] = value
    }
  }
  return processedFields
}

function verifySignature(signature: string, basestring: string) {
  const verify = crypto.createVerify('sha256')
  verify.write(basestring)
  verify.end()

  const publicKey = Buffer.from(appConfig.gathersg.publicKey, 'base64')
  const verified = verify.verify(publicKey, Buffer.from(signature, 'base64'))

  if (!verified) {
    throw new Error('Unable to verify GatherSG webhook signature')
  }

  return verified
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

    verifySignature(signature, `${$.webhookUrl}.${app}.${timestamp}`)

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
      validateData(decryptedData, $.flow.id, app)

      const processedFields = processFields(decryptedData.fields)

      $.request.body = {
        app,
        data: {
          ...decryptedData,
          fields: processedFields,
        },
        signature,
        timestamp,
      }

      return {
        verified: true,
        internalId: getInternalId(decryptedData),
      }
    } else {
      validateData(data, $.flow.id, app)
      const processedFields = processFields(data.fields)
      $.request.body = {
        app,
        data: {
          ...data,
          fields: processedFields,
        },
        signature,
        timestamp,
      }

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
