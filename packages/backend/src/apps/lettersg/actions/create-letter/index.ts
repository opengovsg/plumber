import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { getTemplateData } from '../../common/get-template-data'
import { downloadAndStoreAttachmentInS3 } from '../../helpers/attachment'

import getDataOutMetadata from './get-data-out-metadata'
import { requestSchema, responseSchema } from './schema'

function handleZodError(error: ZodError): never {
  const firstError = fromZodError(error).details[0]
  throw new StepError(
    `${firstError.message}`,
    GenericSolution.ReconfigureInvalidField,
  )
}

const action: IRawAction = {
  name: 'Create letter',
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
      label: 'Export as PDF',
      key: 'shouldGeneratePdf',
      type: 'boolean-radio' as const,
      required: true,
      description:
        'Please add an "Email by Postman" action to send the letter. By default, recipients will receive a link to view the mobile-friendly digital letter. If necessary, they can download the letter as a PDF from the link.',
      value: false,
      options: [
        {
          label: 'Send the letter link directly (Recommended)',
          value: false,
        },
        {
          label: 'Export letter as PDF to send',
          value: true,
        },
      ],
    },
    {
      label: 'Personalised fields',
      key: 'letterParams',
      type: 'multirow-multicol' as const,
      required: true,
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
          customStyle: { flex: 2 },
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const payloadResult = requestSchema.safeParse($.step.parameters)

    if (payloadResult.success === false) {
      handleZodError(payloadResult.error)
    }

    const rawResponse = await $.http.post('/v1/letters', payloadResult.data)
    const responseResult = responseSchema.safeParse(rawResponse.data)

    if (responseResult.success === false) {
      handleZodError(responseResult.error)
    }

    const response = responseResult.data

    if (
      !$.step.parameters.shouldGeneratePdf ||
      !$.flow.hasFileProcessingActions
    ) {
      $.setActionItem({
        raw: response,
      })
      return
    }

    const { data: templateData } = await getTemplateData($)

    // Note: s3 won't allow for template names with .., we only need to replace / with _ because of how we denote a S3 ID
    const templateName = templateData.name.replaceAll('/', '_')
    const attachmentS3Key = await downloadAndStoreAttachmentInS3(
      $,
      response.publicId,
      templateName,
    )
    $.setActionItem({
      raw: {
        ...response,
        attachment: attachmentS3Key,
      },
    })
  },
}

export default action
