import type { ParsedMrfWorkflow } from '@/apps/formsg/common/types'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { UserFacingError } from '@/errors/user-facing-error'
import { getIfThenChildCount } from '@/graphql/mutations/ai/schemas/actions.zod'

import type { McpStepInput } from './create-flow-with-steps'

function isIfThen(step: McpStepInput): boolean {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IF_THEN
}

function isForEach(step: McpStepInput): boolean {
  return (
    step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH
  )
}

/** Groups the actions into units: one action, or an If step with its block. */
function toUnits(actions: McpStepInput[]): McpStepInput[][] {
  const units: McpStepInput[][] = []
  for (let index = 0; index < actions.length; index++) {
    const blockSize = isIfThen(actions[index])
      ? getIfThenChildCount(actions, index)
      : 0
    units.push(actions.slice(index, index + 1 + blockSize))
    index += blockSize
  }
  return units
}

const branchOf = (step: McpStepInput) => step.mrfBranch ?? 'approve'

/**
 * Checks every action of an MRF pipe before anything is created. Each action
 * needs a stage, since the stage steps decide where it can go. A For-each
 * follows the editor's rule: it covers every later step on its path, so it
 * has to be the last step there.
 */
export function validateMrfPlacements(
  steps: McpStepInput[],
  mrfWorkflow: ParsedMrfWorkflow | undefined,
): void {
  if (!mrfWorkflow) {
    if (steps.some((step) => step.mrfStage || step.mrfBranch)) {
      throw new UserFacingError(
        'mrf_stage and mrf_branch only apply to an MRF form. Pass form_url for an MRF form.',
      )
    }
    return
  }

  const stageCount = mrfWorkflow.actions.length + 1
  const units = toUnits(steps.slice(1))

  for (const [unitIndex, [step]] of units.entries()) {
    if (!step.mrfStage) {
      throw new UserFacingError(
        `Every action of an MRF pipe needs mrf_stage, a stage number from 1 to ${stageCount}.`,
      )
    }
    if (step.mrfStage < 1 || step.mrfStage > stageCount) {
      throw new UserFacingError(
        `mrf_stage ${step.mrfStage} does not exist. This form has stages 1 to ${stageCount}.`,
      )
    }
    if (
      step.mrfBranch === 'reject' &&
      (step.mrfStage === 1 ||
        !mrfWorkflow.actions[step.mrfStage - 2].approvalField)
    ) {
      throw new UserFacingError(
        `Stage ${step.mrfStage} is not an approval stage, so mrf_branch "reject" does not apply.`,
      )
    }

    if (!isForEach(step)) {
      continue
    }
    if (branchOf(step) === 'approve' && step.mrfStage !== stageCount) {
      throw new UserFacingError(
        `A For-each covers every later step, so on the approve path it can only go on the last stage (${stageCount}).`,
      )
    }
    const hasLaterStepOnSamePath = units
      .slice(unitIndex + 1)
      .some(
        ([later]) =>
          later.mrfStage === step.mrfStage &&
          branchOf(later) === branchOf(step),
      )
    if (hasLaterStepOnSamePath) {
      throw new UserFacingError(
        'A For-each has to be the last action on its path, because it covers every later step.',
      )
    }
  }
}

/**
 * Orders an MRF pipe's steps the way they end up in the pipe: by stage, with
 * the approve path before the reject path. The layout rules then check the
 * pipe that gets built, not the order the model listed the steps in.
 */
export function orderMrfPipeSteps(steps: McpStepInput[]): McpStepInput[] {
  const [trigger, ...actions] = steps
  const rank = (step: McpStepInput) =>
    (step.mrfStage ?? 0) * 2 + (branchOf(step) === 'reject' ? 1 : 0)

  const ordered = toUnits(actions)
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => rank(a.unit[0]) - rank(b.unit[0]) || a.index - b.index)
    .flatMap(({ unit }) => unit)

  return [trigger, ...ordered].map((step, index) => ({
    ...step,
    position: index + 1,
  }))
}
