import { IJSONArray, IRawAction } from '@plumber/types'

import appConfig from '@/config/app'
import StepError from '@/errors/step'

import { getToken } from '../../auth/get-token'
import { getAttachmentsFromS3, getValidationError } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'
import { requestSchema } from './schema'

const action: IRawAction = {
  name: 'Use generalised model',
  key: 'useGeneralisedModel',
  description:
    'For interpretation of documents with standard or non-standard formats',
  arguments: [
    {
      label: 'Attachments',
      key: 'attachments',
      description: 'Use files from previous steps',
      type: 'multiselect' as const,
      required: false,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Info To Extract',
      key: 'infoToExtract',
      type: 'multirow' as const,
      required: true,
      description: 'Add info to extract here.',
      variables: true,
      addRowButtonText: 'Add',
      subFields: [
        {
          placeholder: 'Info To Extract',
          key: 'infoToExtract',
          type: 'string' as const,
          required: true,
          variables: false,
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { attachments, infoToExtract } = $.step.parameters as {
      attachments?: IJSONArray
      infoToExtract: Array<{ infoToExtract: string }>
    }

    if (!$.auth.data.clientId || !$.auth.data.clientSecret) {
      throw new StepError(
        'Missing client ID or client secret',
        'Please check the client ID and client secret',
        $.step.position,
        $.app.name,
      )
    }

    const result = requestSchema.safeParse({ attachments, infoToExtract })

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
      /**
       * FIXME (kevinkim-ogp): should only accept one attachment
       * use a different selector on the frontend or update the
       * multi-select to only allow one attachment
       */
      // Pre-call get attachments from S3 first
      const attachmentFiles = await getAttachmentsFromS3(
        result.data.attachments,
        $.flow.id,
      )
      const attachment = attachmentFiles[0]

      // Step 1: get AWS Cognito access token
      const token = await getToken($)

      /**
       * TODO (kevinkim-ogp): first iteration of AISAY will only support synchronous calls
       * - add a check to ensure that the attachment is less than 9 MB (7 MB to be safe)
       * - add a check to ensure that the call to the model is less than 29 seconds
       */
      // Step 2: Call the model to get the output
      const res = await $.http.request({
        url: `${appConfig.aisayApiUrl}/query`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          gpt_query: result.data.infoToExtract,
          image: attachment.data,
        },
      })

      $.setActionItem({ raw: { ...res.data } })
    } catch (err) {
      console.error(err)
      if (err.response.data.message === `Request Too Long`) {
        throw new StepError(
          'File too large',
          'Please try again with a smaller file.',
          $.step.position,
          $.app.name,
        )
      } else {
        throw new StepError(
          'Failed to call generalised model',
          'Please try again.',
          $.step.position,
          $.app.name,
        )
      }
    }
  },
} satisfies IRawAction

export default action
