import { AttributeValue } from '@opentelemetry/api'
import { generateObject as AiSdkGenerateObject } from 'ai'
import z from 'zod/v3'

import logger from '@/helpers/logger'
import { model } from '@/helpers/pair'

async function generateObject(
  prompt: string,
  schema: z.ZodObject<any>,
  metadata: Record<string, AttributeValue>,
): Promise<any> {
  try {
    const { object } = await AiSdkGenerateObject({
      model,
      schema,
      system:
        "Based on the user's prompt, generate an object that adheres to the provided schema.",
      prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'pair-action-generate-object',
        metadata,
      },
    })

    return object
  } catch (error) {
    logger.error('Failed to generate object', {
      error: error,
      ...metadata,
    })
    throw error
  }
}

export default generateObject
