import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { VALIDATION_ERROR_SOLUTION } from '@/apps/postman/common/constants'
import StepError from '@/errors/step'

import { getApiBaseUrl } from '../../common/api'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Create Letter',
  key: 'createLetter',
  description: 'Create a new letter based on the template id input',
  arguments: [
    {
      label: 'Template Id',
      key: 'templateId',
      type: 'string' as const,
      required: true,
      description:
        'You can obtain the letter template id using the getTemplate action.',
      variables: true,
    },
    {
      label: 'Parameters',
      key: 'letterParams',
      type: 'multirow' as const,
      required: false,
      description:
        'These are the field names and values for your letter template.',
      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
    {
      label: 'Recipient Email',
      key: 'recipientEmail',
      type: 'string' as const,
      required: false,
      description: 'This is the email that will receive the letter link.',
      variables: true,
    },
  ],

  async run($) {
    const apiKey = $.auth.data.apiKey as string
    const baseUrl = getApiBaseUrl(apiKey)

    // TODO (mal): check whether to support SMS also
    try {
      const payload = requestSchema.parse($.step.parameters)

      // post response
      const rawResponse = await $.http.post('/v1/letters', payload, {
        baseURL: baseUrl,
        headers: {
          authorization: `Bearer ${$.auth.data.apiKey}`,
        },
      })
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({ raw: response })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]
        throw new StepError(
          `${firstError.message} at "${firstError.path}"`,
          VALIDATION_ERROR_SOLUTION,
          $.step.position,
          $.app.name,
        )
      }

      throw new StepError(
        `An error occurred: '${error.message}'`,
        'Please check that you have configured your step correctly',
        $.step.position,
        $.app.name,
      )
    }
  },
}

export default action
