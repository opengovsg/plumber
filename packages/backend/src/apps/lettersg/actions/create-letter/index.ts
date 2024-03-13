import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { requestSchema, responseSchema } from './schema'

// TODO: update when letters provide a standard error format for all errors
type LettersApiErrorData = {
  message: string
  success?: boolean
  errors?: Record<string, string>[]
}

const action: IRawAction = {
  name: 'Create Letter',
  key: 'createLetter',
  description: 'Create a new letter based on the template id input',
  arguments: [
    {
      label: 'Template',
      key: 'templateId',
      placeholder: 'Template',
      type: 'dropdown' as const,
      required: true,
      description:
        'Choose the template you want for creating a letter. You need to have an existing template in your Letters account first.',
      variables: false,
      showOptionValue: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'getTemplateIds',
          },
        ],
      },
    },
    {
      label: 'Letter Parameters',
      key: 'letterParams',
      type: 'multirow' as const,
      required: false,
      description:
        'Specify letter values for each field name in your letter template.',

      subFields: [
        {
          placeholder: 'Field',
          key: 'field' as const,
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          variables: false,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'getTemplateFields',
              },
              {
                name: 'parameters.templateId',
                value: '{parameters.templateId}',
              },
            ],
          },
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
  ],

  async run($) {
    try {
      const payload = requestSchema.parse($.step.parameters)

      // post response
      const rawResponse = await $.http.post('/v1/letters', payload)
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({ raw: response })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]
        throw new StepError(
          `${firstError.message} under set up action`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }
      // TODO (mal): check which fields are not used and return
      const lettersErrorData: LettersApiErrorData = error.response.data
      if (lettersErrorData.message === 'Malformed bulk create object') {
        throw new StepError(
          'Missing pair of field/value for letter template',
          'Click on set up action and check that you have entered all the fields and values in the letter parameters.',
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
