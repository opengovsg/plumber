import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

import { fetchCaseData, fetchCaseFields } from '../../common/fetch-case-data'
import { buildFieldsSchema } from '../../common/schema-builder'
import throwGatherSGStepError from '../../common/throw-errors'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Update case',
  key: 'updateCase',
  description: 'Update a case based on the case uuid',
  arguments: [
    {
      label: 'Case UUID',
      key: 'caseUuid',
      type: 'string' as const,
      description: 'Enter the case uuid you want to update',
      required: true,
      variables: true,
      singleVariableSelection: true,
    },
    // TODO: see if it is possible to get all possible statuses from the API
    {
      label: 'Case status',
      key: 'caseStatus',
      type: 'string' as const,
      description: 'Enter the status you want to update the case to.',
      required: false,
      variables: true,
    },
    {
      label: 'Case fields',
      key: 'caseFields',
      type: 'multirow-multicol' as const,
      required: false,
      description:
        'Specify values for each field you want to update in your case. Note that fields that require an array of objects as a value are not supported yet.',

      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
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
                value: 'getCaseFields',
              },
              {
                name: 'parameters.caseUuid',
                value: '{parameters.caseUuid}',
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
          hiddenIf: {
            fieldKey: 'fieldType',
            op: 'equals',
            fieldValue: 'null',
          },
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
    },
  ],

  async run($) {
    try {
      const parameters = requestSchema.parse($.step.parameters)
      const { caseUuid, caseStatus, caseFields } = parameters

      // Fetch case data to get the case type UUID
      const caseData = await fetchCaseData({ $, caseUuid })
      const caseTypeUuid = caseData.type.uuid
      const { filteredFields } = await fetchCaseFields({
        $,
        caseTypeUuid,
      })

      // based on the fields in the case, we build the schema to parse the case fields
      const fieldsSchema = buildFieldsSchema(filteredFields)
      const fields = fieldsSchema.parse(caseFields)

      const payload = {
        ...(caseStatus && { status: caseStatus }),
        fields,
      }

      const rawResponse = await $.http.patch('/cases/:caseUuid', payload, {
        urlPathParams: { caseUuid },
      })
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({
        raw: {
          ...response,
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]
        throw new StepError(
          `${firstError.path[0]}: ${firstError.message}`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }

      if (error instanceof HttpError) {
        throwGatherSGStepError({ $, error })
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
