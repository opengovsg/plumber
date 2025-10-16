import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import { ensureZodEnumValue } from '@/helpers/zod-utils'

import { fetchCaseFields } from '../../common/fetch-case-fields'
import throwGatherSGStepError from '../../common/throw-errors'

import getDataOutMetadata from './get-data-out-metadata'
import { fieldTypeEnum, requestSchema, responseSchema } from './schema'

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
      type: 'dropdown' as const,
      description: 'Select the status you want to update the case to.',
      required: false,
      variables: true,
      showOptionValue: false,
      hiddenIf: {
        fieldKey: 'caseType',
        op: 'is_empty',
      },
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [{ name: 'key', value: 'getCaseStatuses' }],
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
          placeholder: 'Field type',
          key: 'fieldType',
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          value: 'string',
          variables: false,
          options: [
            {
              label: 'Text',
              value: ensureZodEnumValue(fieldTypeEnum, 'string'),
            },
            {
              label: 'Number',
              value: ensureZodEnumValue(fieldTypeEnum, 'number'),
            },
            {
              label: 'Null',
              value: ensureZodEnumValue(fieldTypeEnum, 'null'),
            },
          ],
          customStyle: { flex: 1, maxWidth: 140 },
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

  getDataOutMetadata,

  async run($) {
    try {
      const paramaters = requestSchema.parse($.step.parameters)
      const { caseType: caseTypeUuid, status, fields } = paramaters

      // get the case type name from the case type uuid
      const { caseTypeName } = await fetchCaseFields({ $, caseTypeUuid })

      const payload = {
        ...(status && { status }),
        fields,
        type: caseTypeName,
      }

      const rawResponse = await $.http.post('/cases', payload)
      const { data } = responseSchema.parse(rawResponse.data)

      $.setActionItem({
        raw: {
          data,
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
