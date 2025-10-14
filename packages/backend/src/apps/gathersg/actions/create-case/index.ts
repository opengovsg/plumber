import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

import { fetchCaseFields } from '../../common/fetch-case-fields'
import { buildFieldsSchema } from '../../common/schema-builder'
import throwGatherSGStepError from '../../common/throw-errors'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Create case',
  key: 'createCase',
  description: 'Create a case',
  arguments: [
    {
      label: 'Case type',
      key: 'caseType',
      type: 'dropdown' as const,
      description: 'Enter the type of the case you want to create',
      required: true,
      variables: false,
      showOptionValue: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'getCaseTypes',
          },
        ],
      },
    },
    {
      label: 'Case status',
      key: 'caseStatus',
      type: 'string' as const,
      description: 'Enter the status you want to update the case to.',
      required: false,
      variables: true,
      hiddenIf: {
        fieldKey: 'caseType',
        op: 'is_empty',
      },
    },
    {
      label: 'Case fields',
      key: 'caseFields',
      type: 'multirow-multicol' as const,
      required: true,
      description:
        'Specify values for each field you want to update in your case. Note that fields that require an array of objects as a value are not supported yet.',
      hiddenIf: {
        fieldKey: 'caseType',
        op: 'is_empty',
      },
      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          variables: false,
          allowArbitrary: true,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'getCaseFields',
              },
              {
                name: 'parameters.caseType',
                value: '{parameters.caseType}',
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
      const paramaters = requestSchema.parse($.step.parameters)
      const { caseType, caseStatus, caseFields } = paramaters

      // NOTE: extra step to retrieve the case type name using the caseTypeUuid
      const { filteredFields, caseTypeName } = await fetchCaseFields({
        $,
        caseTypeUuid: caseType,
      })

      // based on the fields in the case, we build the schema to parse the case fields
      const fieldsSchema = buildFieldsSchema(filteredFields)
      const fields = fieldsSchema.parse(caseFields)

      const payload = {
        ...(caseStatus && { status: caseStatus }),
        fields,
        type: caseTypeName,
      }

      const rawResponse = await $.http.post('/cases', payload)
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({
        raw: {
          response,
        },
      })
    } catch (error) {
      console.error('error', error)
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
