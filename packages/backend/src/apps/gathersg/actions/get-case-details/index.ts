import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import { processAttachments } from '../../common/attachment'
import { processFields } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Get case details',
  key: 'getCaseDetails',
  description: 'Select the case uuid you want to get case details for.',
  arguments: [
    {
      label: 'Case UUID',
      key: 'caseUuid',
      type: 'string' as const,
      required: true,
      variables: true,
      // we intentionally disable typing for case uuid as it is used in
      // to get dynamic data for case fields
      // it can still be pasted via mouse click
      singleVariableSelection: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    try {
      const { caseUuid } = $.step.parameters

      let rawData
      try {
        const { data } = await $.http.get(`/cases/:caseUuid`, {
          urlPathParams: { caseUuid },
        })
        rawData = data
      } catch (error) {
        logger.error(`Failed to get case details for case ${caseUuid}:`, error)
        throw new StepError(
          `Invalid case uuid: ${caseUuid}`,
          'Please check that you have configured your step correctly',
          error,
        )
      }

      const fields = rawData.data?.fields
      if (!fields) {
        throw new StepError(
          `No data found for case ${caseUuid}`,
          'Please check that you have configured your step correctly',
        )
      }

      // hex encode the field names
      const processedFields = processFields(fields)

      // process the attachments
      const attachments = await processAttachments(
        $,
        caseUuid,
        rawData.data?.attachments,
      )

      $.setActionItem({
        raw: {
          ...rawData,
          data: {
            ...rawData.data,
            fields: processedFields,
            attachments,
          },
        },
      })
    } catch (error) {
      logger.error(
        `Failed to get case details for case ${$.step.parameters.caseUuid}:`,
        error,
      )
      throw new StepError(
        `An error occurred: '${error.message}'`,
        'Please check that you have configured your step correctly',
      )
    }
  },
}

export default action
