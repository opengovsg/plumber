import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

import { downloadAndStoreAttachmentInS3 } from '../../helpers/attachment'
import { processMissingFields } from '../../helpers/process-missing-fields'

import getDataOutMetadata from './get-data-out-metadata'
import { requestSchema, responseSchema } from './schema'

// TODO (mal): update when letters provide a standard error format for all errors
type LettersApiFieldErrorData = {
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
      label: 'Generate PDF',
      key: 'shouldGeneratePdf',
      type: 'dropdown' as const,
      required: true,
      description:
        'You will need to add an Email by Postman action after this step to send out the generated PDF.',
      variables: false,
      value: 'no',
      showOptionValue: false,
      options: [
        {
          label: 'No',
          value: 'no',
        },
        {
          label: 'Yes',
          value: 'yes',
        },
      ],
    },
    {
      label: 'Personalised fields',
      key: 'letterParams',
      type: 'multirow' as const,
      required: false,
      description:
        'Specify values for each personalised field in your template.',

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
  getDataOutMetadata,

  async run($) {
    try {
      const payload = requestSchema.parse($.step.parameters)

      // post response, TODO (mal): double try catch
      const rawResponse = await $.http.post('/v1/letters', payload)
      const response = responseSchema.parse(rawResponse.data)

      if (
        !$.step.parameters.shouldGeneratePdf ||
        !$.flow.hasFileProcessingActions
      ) {
        $.setActionItem({
          raw: response,
        })
        return
      }

      const attachmentS3Key = await downloadAndStoreAttachmentInS3(
        $,
        response.publicId,
      )
      $.setActionItem({
        raw: {
          ...response,
          attachment: attachmentS3Key,
        },
      })
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
      if (error instanceof HttpError && error.response.status === 400) {
        const missingFields = await processMissingFields($)
        const lettersErrorData: LettersApiFieldErrorData = error.response.data
        if (lettersErrorData?.message === 'Invalid letter params.') {
          throw new StepError(
            `Personalised field(s) not specified${
              missingFields.length === 0 ? '' : `: ${missingFields}`
            }`,
            'Click on set up action and check that you have entered all the fields and values in the letter parameters.',
            $.step.position,
            $.app.name,
          )
        }
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
