import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'

import { processAttachments } from '../../common/attachment'
import {
  caseIdentifierSchema,
  resolveCaseIdentifier,
} from '../../common/case-identifier'
import throwGatherSGStepError from '../../common/throw-errors'
import { processFields } from '../../common/utils'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Get case details',
  key: 'getCaseDetails',
  description:
    'Select the case uuid or case ref you want to get case details for.',
  arguments: [
    {
      label: 'Case UUID or case ref',
      key: 'caseUuid',
      type: 'string' as const,
      required: true,
      description: 'Select a variable with a case UUID or case ref.',
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
      const caseIdentifier = caseIdentifierSchema.parse(
        $.step.parameters.caseUuid,
      )
      const caseUuid = await resolveCaseIdentifier($, caseIdentifier)

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
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]
        throw new StepError(
          `${firstError.message}`,
          GenericSolution.ReconfigureInvalidField,
        )
      }

      if (error instanceof StepError) {
        throw error
      }

      if (error instanceof HttpError) {
        throwGatherSGStepError(error)
      }

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
