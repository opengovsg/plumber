import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Get case details',
  key: 'getCaseDetails',
  description: 'Get details of a case based on the case uuid',
  arguments: [
    {
      label: 'Case UUID',
      key: 'caseUuid',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    try {
      const { caseUuid } = $.step.parameters
      const { data: rawData } = await $.http.get(`/cases/:caseUuid`, {
        urlPathParams: { caseUuid },
      })

      const { fields } = rawData.data

      // hex encode the field names
      const hexEncodedFields: Record<string, any> = {}
      for (const [key, value] of Object.entries(fields)) {
        const hexKey = Buffer.from(key).toString('hex')
        hexEncodedFields[hexKey] = value
      }

      $.setActionItem({
        raw: {
          ...rawData,
          data: {
            ...rawData.data,
            fields: hexEncodedFields,
          },
        },
      })
    } catch (error) {
      logger.error('Failed to get case details:', error)
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
