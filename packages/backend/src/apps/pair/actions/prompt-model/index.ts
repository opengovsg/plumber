import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { VALIDATION_ERROR_SOLUTION } from '@/apps/postman/common/constants'
import appConfig from '@/config/app'
import StepError from '@/errors/step'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Prompt Model',
  key: 'promptModel',
  description: 'Prompt AI model for an answer',
  arguments: [
    {
      label: 'Prompt',
      key: 'prompt',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    try {
      const payload = {
        prompt: requestSchema.parse($.step.parameters).prompt,
        model: 'gpt-3.5-turbo',
      }

      const rawResponse = await $.http.post(
        `/integrations/completion`,
        payload,
        {
          baseURL: 'https://staging.pair.gov.sg/api/v1',
          headers: {
            'x-api-key': appConfig.pair.apiKey,
          },
        },
      )
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({ raw: response })
    } catch (e) {
      if (e instanceof ZodError) {
        const firstError = fromZodError(e).details[0]

        throw new StepError(
          `${firstError.message} at "${firstError.path}"`,
          VALIDATION_ERROR_SOLUTION,
          $.step.position,
          $.app.name,
        )
      }

      throw e
    }
  },
}

export default action
