import type { IGlobalVariable } from '@plumber/types'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import Connection from '@/models/connection'

import { validateAuthData } from './auth-data'
import {
  DUPLICATE_ASSISTANT_MESSAGE,
  getMockAssistantName,
} from './mock-assistants'
import { PairConnectionError } from './pair-connection-error'

async function hasAddedApiKey($: IGlobalVariable, apiKey: string) {
  const existingConnections = await Connection.query()
    .where({ key: $.app.key, user_id: $.user.id, verified: true })
    .whereNot({ id: $.auth.connectionId })

  return existingConnections.some(
    (connection) => connection.formattedData?.apiKey === apiKey,
  )
}

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  try {
    const { apiKey } = validateAuthData($)

    if (await hasAddedApiKey($, apiKey)) {
      throw new PairConnectionError(DUPLICATE_ASSISTANT_MESSAGE)
    }

    const screenName = await getMockAssistantName(apiKey)
    await $.auth.set({ screenName })
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(fromZodError(error).details[0].message)
    }
    throw error
  }
}
