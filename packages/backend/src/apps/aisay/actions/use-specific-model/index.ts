import { IRawAction } from '@plumber/types'

import appConfig from '@/config/app'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import Step from '@/models/step'

import { getToken } from '../../auth/get-token'
import { parseError } from '../../common/error-parser'
import { specificModelSchema } from '../../common/schema'
import { getAttachmentFromS3, getValidationError } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Extract data from specific document types',
  key: 'useSpecificModel',
  description:
    'Optimised for bank statements, invoices, cheques, passports and receipts.',
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
      label: 'Document type',
      key: 'documentType',
      type: 'dropdown',
      options: [
        { label: 'Bank statement', value: 'BANK_STATEMENT' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'Invoice', value: 'INVOICE' },
        { label: 'Passport', value: 'PASSPORT' },
        { label: 'Receipt', value: 'RECEIPT' },
      ],
      showOptionValue: false,
      required: true,
    },
  ],
  doesFileProcessing: (step: Step) => {
    return step.parameters.file && step.parameters.file !== ''
  },
  getDataOutMetadata,

  async run($) {
    const { file, documentType } = $.step.parameters as {
      file: string
      documentType: string
    }

    if (!$.auth.data?.clientId || !$.auth.data?.clientSecret) {
      throw new StepError(
        'Missing client ID or client secret',
        'Please check the client ID and client secret',
        $.step.position,
        $.app.name,
      )
    }

    const result = specificModelSchema.safeParse({ file, documentType })
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
      const aisayRes = await $.http.request({
        url: `${appConfig.aisayApiUrl}/query`,
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
      logger.error(err)
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
