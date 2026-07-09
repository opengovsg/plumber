import type { IJSONObject } from '@plumber/types'

import z from 'zod/v3'

import { getActionStepsSchema } from '@/graphql/mutations/ai/schemas/action-steps-schema'
import { generateSchema } from '@/graphql/mutations/ai/schemas/schema-generator'
import { getStepVersion } from '@/helpers/get-step-version'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import type User from '@/models/user'

export interface McpStepInput {
  appKey: string
  key?: string | null
  type: 'trigger' | 'action'
  position: number
  parameters?: Record<string, unknown>
}

export async function createFlowWithStepsService({
  user,
  name,
  steps,
  traceId,
}: {
  user: User
  name: string
  steps: McpStepInput[]
  traceId: string
}): Promise<Flow> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  if (steps.length === 0) {
    throw new Error('At least one step is required.')
  }

  if (
    !steps.every((step, index) => {
      if (index === 0) {
        return step.position === 1
      }
      return step.position === steps[index - 1].position + 1
    })
  ) {
    throw new Error('Must be contiguous steps!')
  }

  // Validate only when all steps have keys
  const allKeysProvided = steps.every((s) => !!s.key)

  if (allKeysProvided) {
    const restrictedApps = getRestrictedAppKeys(await getAllLdFlags(user.email))
    const triggerSchema = generateSchema(
      z.object({ type: z.literal('trigger') }),
      'trigger',
      restrictedApps,
    )
    const validatedTrigger = triggerSchema.safeParse(steps[0])
    if (!validatedTrigger.success) {
      logger.error(
        'Failed to create flow with steps: Pipe must always start with a trigger',
        { error: validatedTrigger.error.errors },
      )
      throw new Error('Pipe must always start with a trigger')
    }

    const actionSteps = steps.slice(1)
    if (actionSteps.length > 0) {
      const actionStepsSchema = getActionStepsSchema(restrictedApps)
      const validatedActions = actionStepsSchema.safeParse(actionSteps)
      if (!validatedActions.success) {
        logger.error(
          'Failed to create flow with steps: Pipe contains invalid action steps',
          { error: validatedActions.error.errors },
        )
        throw new Error('Pipe contains invalid action steps')
      }
    }
  }

  const flow = await Flow.transaction(async (trx) => {
    const createdFlow = await Flow.query(trx).insertAndFetch({
      userId: user.id,
      name: trimmedName,
      active: false,
      config: { aiBuilderConfig: { traceId } },
    })

    let ifThenCount = 0
    await createdFlow.$relatedQuery('steps', trx).insert(
      steps.map((step) => {
        let defaults: Record<string, unknown> = {}
        if (step.appKey === 'toolbox' && step.key === 'ifThen') {
          defaults = { branchName: `Branch ${++ifThenCount}`, depth: 0 }
        }
        return {
          version: getStepVersion(step.appKey, step.key ?? undefined),
          type: step.type,
          appKey: step.appKey,
          key: step.key ?? null,
          config: {},
          parameters: {
            ...defaults,
            ...(step.parameters ?? {}),
          } as IJSONObject,
          position: step.position,
        }
      }),
    )

    return createdFlow
  })

  return flow.$fetchGraph('steps')
}
