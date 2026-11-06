import type { IJSONObject } from '@plumber/types'
import z from 'zod'

import { createMrfSteps } from '@/apps/formsg/triggers/new-submission/create-mrf-steps'
import { parseMrfWorkflow } from '@/apps/formsg/triggers/new-submission/get-workflow-data'
import {
  BLOCK_END_STEP_ID,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import {
  pinEndStep,
  validateEndStepWrite,
} from '@/apps/toolbox/common/validate-end-step'
import { UserFacingError } from '@/errors/user-facing-error'
import { getActionStepsSchema } from '@/graphql/mutations/ai/schemas/action-steps-schema'
import {
  getIfThenChildCount,
  validateActionStepsRules,
  validateBlockRules,
  validateExecutionPathRules,
} from '@/graphql/mutations/ai/schemas/actions.zod'
import { generateSchema } from '@/graphql/mutations/ai/schemas/schema-generator'
import { getStepVersion } from '@/helpers/get-step-version'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import type User from '@/models/user'
import { lookupStepDefinition } from '@/services/step-definition'

import { addMrfActions, MrfStageStepsError } from './add-mrf-actions'
import { fetchPublicForm } from './fetch-public-form'
import {
  getMrfExecutionPaths,
  orderMrfPipeSteps,
  validateMrfPlacements,
} from './mrf-pipe-layout'
import { createStepAiBuilderConfig } from './step-ai-builder-config'

export interface McpStepInput {
  appKey: string
  key?: string | null
  type: 'trigger' | 'action'
  position: number
  parameters?: Record<string, unknown>
  // Number of following steps inside this If block. Only set on
  // toolbox/ifThen steps laid out with explicit blocks.
  ifThenChildCount?: number
  // MRF forms only, on an action outside any If block. The stage it follows,
  // numbered as in get_form_schema's mrfStages (1 is the trigger).
  mrfStage?: number
  // MRF forms only. Which path of an approval stage the action belongs to.
  mrfBranch?: 'approve' | 'reject'
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
  mrfStage?: number
  mrfBranch?: 'approve' | 'reject'
}

function isIfThenInput(step: { appKey?: string; key?: string | null }) {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IF_THEN
}

function isNamedLayoutStep(step: { appKey?: string; key?: string | null }) {
  return (
    isIfThenInput(step) ||
    (step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH)
  )
}

function layoutRuleError(
  issues: { code: string; message: string }[],
): string | null {
  const messages = [
    ...new Set(
      issues
        .filter((issue) => issue.code === 'custom')
        .map((issue) => issue.message),
    ),
  ]
  return messages.length > 0
    ? `Pipe contains invalid action steps: ${messages.join('. ')}.`
    : null
}

/**
 * Layout rule issues of each MRF execution path. The full action list merges
 * the approve and reject paths, so it cannot check these rules itself.
 */
function getExecutionPathIssues(actions: McpStepInput[]) {
  return getMrfExecutionPaths(actions).flatMap((path) => {
    const result = z
      .array(z.custom<McpStepInput>())
      .superRefine(validateExecutionPathRules)
      .safeParse(path)
    return result.success ? [] : result.error.issues
  })
}

/**
 * Flattens the create_pipe tree into positioned steps. Each If block's extent
 * becomes `ifThenChildCount`, which the layout rules and the markers share.
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

/**
 * The workflow of an MRF form, or undefined for any other form. Fetched before
 * the pipe exists so a bad URL fails without leaving a half-built pipe.
 */
async function getMrfWorkflowForTrigger(
  triggerStep: McpStepInput,
  formUrl: string,
  hasPlacements: boolean,
) {
  if (triggerStep.appKey !== 'formsg' || triggerStep.key !== 'newSubmission') {
    throw new UserFacingError('form_url only applies to a FormSG trigger.')
  }

  const result = await fetchPublicForm(formUrl)
  if ('error' in result) {
    // Without mrf_stage the pipe is built as a normal one, so a form that
    // cannot be fetched must not block it.
    if (!hasPlacements) {
      logger.warn('create_pipe: could not check the form for MRF stages', {
        error: result.error,
      })
      return undefined
    }
    throw new UserFacingError(result.error)
  }

  const { form } = result
  // A form left in multirespondent mode with no workflow is a normal form.
  if (form.responseMode !== 'multirespondent' || !form.workflow?.length) {
    return undefined
  }

  try {
    return parseMrfWorkflow(form.workflow)
  } catch {
    throw new UserFacingError(
      "This form's workflow stages could not be read. Ask the user to check the form in FormSG.",
    )
  }
}

export async function createFlowWithStepsService({
  user,
  name,
  steps: requestedSteps,
  traceId,
  formUrl,
}: {
  user: User
  name: string
  steps: McpStepInput[]
  traceId: string
  // Pass the form's URL for a FormSG trigger so an MRF form's stage steps
  // are created too.
  formUrl?: string
}): Promise<Flow> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  if (requestedSteps.length === 0) {
    throw new Error('At least one step is required.')
  }

  // Keyless placeholders skip schema validation, so hidden actions need a separate guard.
  for (const step of requestedSteps) {
    if (
      step.key &&
      lookupStepDefinition(step.appKey, step.key).kind === 'hidden'
    ) {
      throw new Error('Action can only be created by system')
    }
  }

  if (
    !requestedSteps.every((step, index) => {
      if (index === 0) {
        return step.position === 1
      }
      return step.position === requestedSteps[index - 1].position + 1
    })
  ) {
    throw new Error('Must be contiguous steps!')
  }

  const ldFlags = await getAllLdFlags(user.email)
  const mrfWorkflow = formUrl
    ? await getMrfWorkflowForTrigger(
        requestedSteps[0],
        formUrl,
        requestedSteps.some((step) => step.mrfStage || step.mrfBranch),
      )
    : undefined
  validateMrfPlacements(requestedSteps, mrfWorkflow)
  const steps = mrfWorkflow ? orderMrfPipeSteps(requestedSteps) : requestedSteps

  // Validate only when all steps have keys
  const allKeysProvided = steps.every((s) => !!s.key)

  if (allKeysProvided) {
    const restrictedApps = getRestrictedAppKeys(ldFlags)
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
      const actionStepsSchema = getActionStepsSchema(restrictedApps, {
        checkExecutionPath: !mrfWorkflow,
      })
      const validatedActions = actionStepsSchema.safeParse(actionSteps)
      const issues = [
        ...(validatedActions.success ? [] : validatedActions.error.issues),
        ...(mrfWorkflow ? getExecutionPathIssues(actionSteps) : []),
      ]
      if (issues.length > 0) {
        logger.error(
          'Failed to create flow with steps: Pipe contains invalid action steps',
          { error: issues },
        )
        // The layout rule messages are already user-facing, and the model
        // needs them to fix its own create_pipe call.
        throw new Error(
          layoutRuleError(issues) ?? 'Pipe contains invalid action steps',
        )
      }
    }
  } else if (steps.some(isNamedLayoutStep)) {
    // A missing key skips the full schema, which also skips these rules.
    const actionSteps = steps.slice(1)
    const layout = z
      .array(z.custom<McpStepInput>())
      .superRefine(mrfWorkflow ? validateBlockRules : validateActionStepsRules)
      .safeParse(actionSteps)
    const message = layoutRuleError([
      ...(layout.success ? [] : layout.error.issues),
      ...(mrfWorkflow ? getExecutionPathIssues(actionSteps) : []),
    ])
    if (message) {
      throw new Error(message)
    }
  }

  // An MRF pipe's actions wait until its stage steps exist, because the stage
  // steps are inserted straight after the trigger.
  const stepsToInsert = mrfWorkflow ? steps.slice(0, 1) : steps

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
      stepsToInsert.map((step) => {
        let defaults: Record<string, unknown> = {}
        if (isIfThenInput(step)) {
          defaults = { branchName: `Branch ${++ifThenCount}`, depth: 0 }
        }
        return {
          version: getStepVersion(step.appKey, step.key ?? undefined),
          type: step.type,
          appKey: step.appKey,
          key: step.key ?? null,
          config: createStepAiBuilderConfig(traceId, 'create_pipe'),
          parameters: {
            ...defaults,
            ...(step.parameters ?? {}),
          } as IJSONObject,
          position: step.position,
        }
      }),
    )

    // Markers point forward, so they need every step's id first.
    for (const [index, step] of stepsToInsert.entries()) {
      if (!isIfThenInput(step)) {
        continue
      }
      const childCount = getIfThenChildCount(stepsToInsert, index)
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

    if (mrfWorkflow) {
      // Same transaction, so a stage failure leaves no half-built pipe behind.
      try {
        await createMrfSteps(
          { flow: { id: createdFlow.id }, step: { id: insertedSteps[0].id } },
          mrfWorkflow,
          trx,
        )
      } catch (error) {
        logger.error('create_pipe: could not create the MRF stage steps', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw new MrfStageStepsError()
      }
    }

    return createdFlow
  })

  if (mrfWorkflow) {
    await addMrfActions({
      user,
      flowId: flow.id,
      actions: steps.slice(1),
      traceId,
    })
    // Re-read, since createMrfSteps added steps and reordered positions.
    const withMrfSteps = await flow.$query().withGraphFetched('steps')
    withMrfSteps.steps.sort((a, b) => a.position - b.position)
    return withMrfSteps
  }

  return flow.$fetchGraph('steps')
}
