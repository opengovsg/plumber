import type { IStep } from '@plumber/types'

import z from 'zod'

import { getStepVersion } from '@/helpers/get-step-version'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'

import { MutationResolvers } from '../../__generated__/types.generated'

import { getActionStepsSchema } from './schemas/action-steps-schema'
import { generateSchema } from './schemas/schema-generator'

const createFlowWithSteps: MutationResolvers['createFlowWithSteps'] = async (
  _parent,
  params,
  context,
) => {
  const {
    input: { steps, flowName, aiBuilderConfig },
  } = params

  const restrictedApps = getRestrictedAppKeys(
    await getAllLdFlags(context.currentUser.email),
  )

  // Generate schema to validate trigger step against the available triggers in apps
  // we also pass restricted apps into the schema so the assistant knows which apps the user cannot use
  const triggerSchema = generateSchema(
    z.object({ type: z.literal('trigger') }),
    'trigger',
    restrictedApps,
  )
  const actionStepsSchema = getActionStepsSchema(restrictedApps)

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
        error: validatedTrigger.error.issues,
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
        error: validatedActions.error.issues,
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

    const normalizedActionSteps = validatedActions.data.map(
      (actionStep, index) => ({
        ...steps[index + 1],
        ...actionStep,
      }),
    )
    // Keep the first step as the trigger; only action steps are rehydrated from validatedActions.
    const normalizedSteps = [steps[0], ...normalizedActionSteps]
    const stepsToInsert = normalizedSteps.map((step: IStep) => {
      return {
        version: getStepVersion(step.appKey, step.key),
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
