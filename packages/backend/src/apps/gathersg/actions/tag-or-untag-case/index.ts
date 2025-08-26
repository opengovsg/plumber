import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { GatherSGError } from '../../common/types'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Tag/Untag case',
  key: 'tagOrUntagCase',
  description: 'Tag or untag a case based on the case id (UUID)',
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
    {
      label: 'Tag or untag',
      key: 'tagOrUntag',
      type: 'boolean-radio' as const,
      required: true,
      description: 'Tag or Untag the case',
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
        `/cases/:caseId/${tagOrUntag ? 'tag' : 'untag'}`,
        payload,
        {
          urlPathParams: {
            caseId: $.step.parameters.caseId,
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
          $.step.position,
          $.app.name,
        )
      }

      // Case cannot be found
      const { code, message } =
        (error.response.data?.error as GatherSGError) || {}
      if (error.response.status === 404 && code === 'RESOURCE_NOT_FOUND') {
        throw new StepError(
          message,
          'Check that you have entered a valid case UUID.',
          $.step.position,
          $.app.name,
        )
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
