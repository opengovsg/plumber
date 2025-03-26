import { IJSONArray, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import { getObjectFromS3Id } from '@/helpers/s3'

import { getToken } from '../../auth/get-token'
import { parseError } from '../../common/error-parser'
import { getValidationError } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'
import { requestSchema } from './schema'

const uint8ArrayToBase64 = (uint8Array: Uint8Array) => {
  return Buffer.from(uint8Array).toString('base64')
}

const action: IRawAction = {
  name: 'Use specific model',
  key: 'useSpecificModel',
  description:
    'For documents with standard formats: Receipt, Invoices, Quotation, Bank Statement, Transfer Advice, Passport, Cheque',
  arguments: [
    {
      label: 'File',
      key: 'attachments',
      description: 'Use file from previous steps',
      type: 'multiselect' as const,
      required: true,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Document Type',
      key: 'documentType',
      type: 'dropdown',
      options: [
        { label: 'Bank Statement', value: 'BANK_STATEMENT' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'Invoice', value: 'INVOICE' },
        { label: 'Passport', value: 'PASSPORT' },
        { label: 'Receipt', value: 'RECEIPT' },
      ],
      showOptionValue: false,
      required: true,
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { attachments, documentType } = $.step.parameters as {
      attachments?: IJSONArray
      documentType: string
    }

    if (!$.auth.data.clientId || !$.auth.data.clientSecret) {
      throw new StepError(
        'Missing client ID or client secret',
        'Please check the client ID and client secret',
        $.step.position,
        $.app.name,
      )
    }

    const result = requestSchema.safeParse({ attachments, documentType })
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
      // Pre-call get attachments from S3 first
      const attachmentFiles = await Promise.all(
        result.data.attachments?.map(async (attachment) => {
          // We verify the flowId here to ensure that the attachment is from the same flow and not
          // maliciously/ manually injected by another user who does not have access to this attachment
          const obj = await getObjectFromS3Id(attachment, { flowId: $.flow.id })
          return { fileName: obj.name, data: uint8ArrayToBase64(obj.data) }
        }),
      )
      const attachment = attachmentFiles[0]

      // Step 1: get AWS Cognito access token
      const token = await getToken($)

      // Assuming we do a synchronous call to the model
      // which needs to be less than 29 seconds
      // and with a document size of less than 9 MB
      // Step 2: Call the model to get the output
      const aisayRes = await $.http.request({
        url: 'https://stg.ai.ff.gov.sg/query',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          document_type: result.data.documentType,
          image: attachment.data,
        },
      })

      $.setActionItem({
        raw: { ...aisayRes.data, documentType: result.data.documentType },
      })
    } catch (err) {
      console.error(err)
      const { stepErrorName, stepErrorSolution } = parseError(err)

      throw new StepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }
  },
} satisfies IRawAction

export default action
