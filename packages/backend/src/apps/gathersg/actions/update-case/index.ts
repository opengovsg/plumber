import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import { ensureZodEnumValue } from '@/helpers/zod-utils'

import throwGatherSGStepError from '../../common/throw-errors'

import { fieldTypeEnum, requestSchema, responseSchema } from './schema'

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
      type: 'dropdown' as const,
      description: 'Enter the status you want to update the case to.',
      required: false,
      variables: false,
      showOptionValue: false,
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
          allowArbitrary: true,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'getCaseFields',
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

  async run($) {
    try {
      const payload = requestSchema.parse($.step.parameters)
      const rawResponse = await $.http.patch('/cases/:caseUuid', payload, {
        urlPathParams: {
          caseUuid: $.step.parameters.caseUuid,
        },
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
          `${firstError.message}`,
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
