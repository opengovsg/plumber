import type { IJSONObject } from '@plumber/types'

import z from 'zod'

import {
  BLOCK_END_STEP_ID,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import {
  pinEndStep,
  validateEndStepWrite,
} from '@/apps/toolbox/common/validate-end-step'
import { getActionStepsSchema } from '@/graphql/mutations/ai/schemas/action-steps-schema'
import { getIfThenChildCount } from '@/graphql/mutations/ai/schemas/actions.zod'
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
  // Number of following steps inside this If block. Only set on
  // toolbox/ifThen steps laid out with explicit blocks.
  ifThenChildCount?: number
}

/**
 * The tree shape the create_pipe tool accepts: an if-then entry carries the
 * steps inside its block as `steps`.
 */
export interface McpNestedStepInput {
  appKey: string
  key?: string | null
  parameters?: Record<string, unknown>
  steps?: McpNestedStepInput[]
}

function isIfThenInput(step: { appKey?: string; key?: string | null }) {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IF_THEN
}

/**
 * Flattens the create_pipe tree into position-ordered steps, recording each
 * If block's extent as `ifThenChildCount` so the layout rules and the
 * endStepId markers see the same block the caller described.
 */
export function flattenNestedSteps(
  nestedSteps: McpNestedStepInput[],
): McpStepInput[] {
  const flattened: McpStepInput[] = []

  const visit = (steps: McpNestedStepInput[], isTopLevel: boolean) => {
    for (const [index, step] of steps.entries()) {
      const { steps: children, ...rest } = step
      const isIfThen = isIfThenInput(rest)

      if (children !== undefined && !isIfThen) {
        throw new Error(
          `Only toolbox/ifThen steps can contain nested steps (found on ${rest.appKey}/${rest.key}).`,
        )
      }
      if (isIfThen && children !== undefined && children.length === 0) {
        throw new Error('An If block must contain at least one step.')
      }

      const flattenedStep: McpStepInput = {
        ...rest,
        type: isTopLevel && index === 0 ? 'trigger' : 'action',
        position: flattened.length + 1,
      }
      flattened.push(flattenedStep)

      if (isIfThen && children !== undefined) {
        const lengthBefore = flattened.length
        visit(children, false)
        flattenedStep.ifThenChildCount = flattened.length - lengthBefore
      }
    }
  }

  visit(nestedSteps, true)
  return flattened
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
        { error: validatedTrigger.error.issues },
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
          { error: validatedActions.error.issues },
        )
        // The layout rule messages are already user-facing, and the model
        // needs them to fix its own create_pipe call.
        const layoutIssues = validatedActions.error.issues
          .filter((issue) => issue.code === 'custom')
          .map((issue) => issue.message)
        throw new Error(
          layoutIssues.length > 0
            ? `Pipe contains invalid action steps: ${layoutIssues.join('. ')}.`
            : 'Pipe contains invalid action steps',
        )
      }
    }
  }

  const flow = await Flow.transaction(async (trx) => {
    const createdFlow = await Flow.query(trx).insertAndFetch({
      userId: user.id,
      name: trimmedName,
      active: false,
      config: {
        aiBuilderConfig: {
          traceId,
          suggested: steps.map((step) => ({
            position: step.position,
            appKey: step.appKey,
            key: step.key ?? null,
          })),
        },
      },
    })

    let ifThenCount = 0
    const insertedSteps = await createdFlow.$relatedQuery('steps', trx).insert(
      steps.map((step) => {
        let defaults: Record<string, unknown> = {}
        if (isIfThenInput(step)) {
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

    // Every AI-built If is an explicit V2 block, so steps after it are never
    // absorbed by the legacy derived extent. Markers are forward references,
    // hence the separate pass once every step has an id.
    for (const [index, step] of steps.entries()) {
      if (!isIfThenInput(step)) {
        continue
      }
      const childCount = getIfThenChildCount(steps, index)
      if (childCount === 0) {
        continue
      }
      const ifThenStep = insertedSteps[index]
      const endStep = insertedSteps[index + childCount]
      if (!endStep) {
        throw new Error('If block extends past the last step of the pipe')
      }
      validateEndStepWrite({
        flowSteps: insertedSteps,
        ifThenStepId: ifThenStep.id,
        endStepId: endStep.id,
        flowId: createdFlow.id,
      })
      await pinEndStep(trx, ifThenStep.id, endStep.id)
      ifThenStep.config = {
        ...ifThenStep.config,
        [BLOCK_END_STEP_ID]: endStep.id,
      }
    }

    return createdFlow
  })

  return flow.$fetchGraph('steps')
}
