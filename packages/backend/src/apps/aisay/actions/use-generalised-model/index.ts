import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import Step from '@/models/step'

import { getToken } from '../../auth/get-token'
import { parseError } from '../../common/error-parser'
import { generalisedModelSchema } from '../../common/schema'
import { getAttachmentFromS3, getValidationError } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Extract data from all document types',
  key: 'useGeneralisedModel',
  description: 'Optimised for standard and non-standard documents',
  arguments: [
    {
      label: 'File',
      key: 'file',
      type: 'dropdown',
      required: true,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Prompts',
      description:
        'Enter prompts to specify how the data should be interpreted and extracted',
      key: 'prompts',
      type: 'multirow' as const,
      required: true,
      variables: true,
      addRowButtonText: 'Add prompt',
      subFields: [
        {
          placeholder: 'E.g. Return the price of individual line items',
          key: 'prompt',
          type: 'string' as const,
          required: true,
          variables: false,
        },
      ],
    },
  ],
  doesFileProcessing: (step: Step) => {
    return step.parameters.file && step.parameters.file !== ''
  },
  getDataOutMetadata,

  async run($) {
    const { file, prompts } = $.step.parameters as {
      file: string
      prompts: Array<{ prompt: string }>
    }

    if (!$.auth.data?.clientId || !$.auth.data?.clientSecret) {
      throw new StepError(
        'Missing client ID or client secret',
        'Please check the client ID and client secret',
        $.step.position,
        $.app.name,
      )
    }

    const result = generalisedModelSchema.safeParse({ file, prompts })
    if (!result.success) {
      const { stepErrorName, stepErrorSolution } = getValidationError(result)

      throw new StepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    try {
      // get attachment from S3 first
      const attachment = await getAttachmentFromS3(result.data.file, $.flow.id)

      // Step 1: get AWS Cognito access token
      const token = await getToken($)

      // Step 2: Call the model to get the output
      const res = await $.http.request({
        url: `${$.app.baseUrl}/query`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          gpt_query: result.data.prompts,
          image: attachment.data,
        },
      })

      $.setActionItem({ raw: { ...res.data } })
    } catch (err) {
      logger.error(err)
      const { stepErrorName, stepErrorSolution } = parseError(err)
      throw new StepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
        err,
      )
    }
  },
} satisfies IRawAction

export default action
