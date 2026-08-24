import crypto from 'crypto'

import { IGlobalVariable } from '@plumber/types'

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

export function validateData(
  data: any,
  flow: NonNullable<IGlobalVariable['flow']>,
  app: string,
) {
  const validationResult = schema.safeParse(data)
  if (!validationResult.success) {
    logger.error(
      `GatherSG: potential infinite loop! Webhook not triggered by user! flowId: ${flow.id}. app: ${app}. case type: ${data?.type}. case uuid: ${data?.uuid}`,
      {
        event: 'ownself-gather-potential-infinite-loop',
        flowId: flow.id,
        isFlowActive: flow.isActive,
      },
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
    const hexKey = invalidCharRegex.test(key)
      ? `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(key).toString('hex')}`
      : key

    // Convert primitive arrays to objects for backward compatibility
    if (Array.isArray(value) && value.length > 0) {
      // Check if it's an array of primitives
      if (typeof value[0] !== 'object' || value[0] === null) {
        // Create an object with both individual elements and the full array
        const arrayObject: Record<string | number, any> = {}

        // Add individual array elements
        for (let i = 0; i < value.length; i++) {
          arrayObject[i] = value[i]
        }

        // Add the full array for the new type: 'array' field
        arrayObject._array = value

        processedFields[hexKey] = arrayObject
      } else {
        // Array of objects - keep as is
        processedFields[hexKey] = value
      }
    } else {
      // Not an array or empty array - keep as is
      processedFields[hexKey] = value
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
      validateData(decryptedData, $.flow, app)

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
      validateData(data, $.flow, app)
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
