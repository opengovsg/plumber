import type { IStep } from '@plumber/types'

import z from 'zod/v3'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

import { ifThenParametersSchema } from './ai/schemas/actions.zod'
import { generateSchema } from './ai/schemas/schema-generator'

// Generate schema to validate trigger step against the available triggers in apps
const triggerSchema = generateSchema(
  z.object({ type: z.literal('trigger') }),
  'trigger',
)

// Generate schema to validate action steps against the available actions in apps
const actionStepSchema = generateSchema(
  z.object({ type: z.literal('action') }),
  'action',
).refine(
  (data) => {
    // IF-THEN special case: parameters are required with depth and branchName
    if (
      data.appKey === TOOLBOX_APP_KEY &&
      data.key === TOOLBOX_ACTIONS.IF_THEN
    ) {
      const result = ifThenParametersSchema.safeParse(data.parameters)
      return result.success
    }
    return true
  },
  {
    message:
      'If-then steps must have parameters with depth (number) and branchName (string)',
  },
)
const actionStepsSchema = z.array(actionStepSchema).min(1)

const createFlowWithSteps: MutationResolvers['createFlowWithSteps'] = async (
  _parent,
  params,
  context,
) => {
  const {
    input: { steps, flowName, aiBuilderConfig },
  } = params

  const trimmedFlowName = flowName.trim()
  if (trimmedFlowName === '') {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  if (
    !steps.every((step, index) => {
      // positions must always start at 1
      // and must be contiguous
      if (index === 0) {
        return step.position === 1
      }
      return step.position === steps[index - 1].position + 1
    })
  ) {
    throw new Error('Must be contiguous steps!')
  }

  // validate the trigger step
  const validatedTrigger = triggerSchema.safeParse(steps[0])
  if (!validatedTrigger.success) {
    logger.error(
      'Failed to create flow with steps: Pipe must always start with a trigger',
      {
        error: validatedTrigger.error.errors,
      },
    )
    throw new Error('Pipe must always start with a trigger')
  }

  // validate the action steps
  const validatedActions = actionStepsSchema.safeParse(steps.slice(1))
  if (!validatedActions.success) {
    logger.error(
      'Failed to create flow with steps: Pipe contains invalid action steps',
      {
        error: validatedActions.error.errors,
      },
    )
    throw new Error('Pipe contains invalid action steps')
  }

  return Flow.transaction(async (trx) => {
    const flow = await context.currentUser.$relatedQuery('flows', trx).insert({
      name: trimmedFlowName,
      config: {
        aiBuilderConfig,
      },
    })

    const stepsToInsert = steps.map((step: IStep) => {
      return {
        type: step.type,
        appKey: step.appKey,
        key: step.key,
        config: step?.config || {},
        parameters: step?.parameters || {},
        position: step.position,
      }
    })

    await flow.$relatedQuery('steps', trx).insert(stepsToInsert)

    return flow
  })
}

export default createFlowWithSteps
