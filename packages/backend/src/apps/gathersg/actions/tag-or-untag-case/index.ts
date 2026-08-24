import type { IRawAction } from '@plumber/types'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

import throwGatherSGStepError from '../../common/throw-errors'
import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Tag/Untag case',
  key: 'tagOrUntagCase',
  description: 'Tag or untag a case based on the case uuid',
  arguments: [
    {
      label: 'Case UUID',
      key: 'caseUuid',
      type: 'string' as const,
      description: 'Enter the case uuid you want to tag or untag',
      required: true,
      variables: true,
      singleVariableSelection: true,
    },
    {
      label: 'Tag or untag',
      key: 'tagOrUntag',
      type: 'boolean-radio' as const,
      required: true,
      description: 'Tag or untag the case',
      value: true,
      options: [
        { label: 'Tag', value: true },
        { label: 'Untag', value: false },
      ],
    },
    {
      label: 'Tag value',
      description: 'Key in a single tag value to be applied to the case',
      key: 'tagValue',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    try {
      const payload = requestSchema.parse($.step.parameters)
      const { tagOrUntag } = payload
      const rawResponse = await $.http.post(
        `/cases/:caseUuid/${tagOrUntag ? 'tag' : 'untag'}`,
        payload,
        {
          urlPathParams: {
            caseUuid: $.step.parameters.caseUuid,
          },
        },
      )
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
        )
      }

      if (error instanceof HttpError) {
        throwGatherSGStepError(error)
      }

      throw new StepError(
        `An error occurred: '${error.message}'`,
        'Please check that you have configured your step correctly',
      )
    }
  },
}

export default action
