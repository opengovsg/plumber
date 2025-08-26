import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import { ensureZodEnumValue } from '@/helpers/zod-utils'

import { GatherSGError } from '../../common/types'

import { fieldTypeEnum, requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Update case',
  key: 'updateCase',
  description: 'Update a case based on the case id (UUID)',
  arguments: [
    {
      label: 'Case ID',
      key: 'caseId',
      type: 'string' as const,
      description:
        'You can only select a step variable here. You should be using a Tile to store your case IDs to make reference to.',
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
      required: true,
      variables: true,
      hiddenIf: {
        fieldKey: 'caseId',
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
                name: 'parameters.caseId',
                value: '{parameters.caseId}',
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
          options: [
            {
              label: 'String',
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
          customStyle: { flex: 1, minWidth: 0 },
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
      hiddenIf: {
        fieldKey: 'caseId',
        op: 'is_empty',
      },
    },
  ],

  async run($) {
    try {
      const payload = requestSchema.parse($.step.parameters)
      const rawResponse = await $.http.patch('/cases/:caseId', payload, {
        urlPathParams: {
          caseId: $.step.parameters.caseId,
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
        // Case status is invalid
        const { code, message, details } = error.response.data
          .error as GatherSGError
        if (error.response.status === 400 && code === 'RESOURCE_NOT_FOUND') {
          throw new StepError(
            message,
            'Check that you have entered a valid case status.',
            $.step.position,
            $.app.name,
          )
        }

        // Invalid field value type entered
        if (error.response.status === 422 && code === 'INVALID_INPUT') {
          const invalidFields = details?.fields as string[]
          throw new StepError(
            'Invalid field value type entered (between numbers, strings, etc)',
            `Check that you have entered the correct value type for the following fields: ${invalidFields.join(
              ', ',
            )}`,
            $.step.position,
            $.app.name,
          )
        }
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
