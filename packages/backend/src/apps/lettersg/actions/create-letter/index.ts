import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { VALIDATION_ERROR_SOLUTION } from '@/apps/postman/common/constants'
import StepError from '@/errors/step'

import { requestSchema, responseSchema } from './schema'

// TBC
type LettersApiErrorData = {
  success: boolean
  message: string
  errors: Record<string, string>[]
}

const action: IRawAction = {
  name: 'Create Letter',
  key: 'createLetter',
  description: 'Create a new letter based on the template id input',
  arguments: [
    {
      label: 'Template Id',
      key: 'templateId',
      placeholder: 'Template',
      type: 'dropdown' as const,
      required: true,
      description: 'Choose the template id you want for creating a letter.',
      variables: false,
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
        'Specify every field name and values for your letter template.',

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
    // TODO (mal): check whether to support email/SMS
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
          `${firstError.message} at "${firstError.path}"`,
          VALIDATION_ERROR_SOLUTION,
          $.step.position,
          $.app.name,
        )
      }
      // if not all fields are used
      const lettersErrorData: LettersApiErrorData = error.response.data
      if (lettersErrorData.message === 'Malformed bulk create object') {
        throw new StepError(
          'Missing fields for letter template',
          'Click on set up action and check that you have used all the fields in the letter parameters.',
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
