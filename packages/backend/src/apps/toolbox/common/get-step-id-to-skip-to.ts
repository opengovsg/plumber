import type { IGlobalVariable, IStep } from '@plumber/types'

import logger from '@/helpers/logger'
import Step from '@/models/step'

import {
  BLOCK_END_STEP_ID,
  isIfThenStep,
  isIfThenV2,
  isOnlyContinueIfStep,
} from './constants'

async function loadFlowSteps($: IGlobalVariable): Promise<Step[]> {
  return Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()
}

/**
 * Resolves the last step (inclusive) of an if-then V2 block. Throws on a
 * corrupt marker instead of silently degrading — a bad marker is a data bug.
 */
function resolveEndStepOrThrow(
  ifThen: Step,
  flowSteps: Step[],
  flowId: string,
): Step {
  const endStepId = ifThen.config[BLOCK_END_STEP_ID] as string
  const endStep = flowSteps.find((step) => step.id === endStepId)
  if (!endStep) {
    logger.error({
      event: 'if-then-dangling-end-step',
      ifThenStepId: ifThen.id,
      endStepId,
      flowId,
    })
    throw new Error(
      `If-then step ${ifThen.id} has a dangling endStepId ${endStepId}`,
    )
  }
  if (endStep.position < ifThen.position) {
    logger.error({
      event: 'if-then-end-step-before-self',
      ifThenStepId: ifThen.id,
      endStepId,
      endStepPosition: endStep.position,
      ifThenPosition: ifThen.position,
      flowId,
    })
    throw new Error(
      `If-then step ${ifThen.id} has an endStepId ${endStepId} positioned before itself`,
    )
  }
  return endStep
}

/**
 * Resolves where execution should resume after a FALSE conditional (if-then or
 * only-continue-if); null means stop.
 */
export async function getStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<string | null> {
  if (isIfThenStep($.step)) {
    return getIfThenStepIdToSkipTo($)
  }
  if (isOnlyContinueIfStep($.step)) {
    return getOnlyContinueIfStepIdToSkipTo($)
  }
  throw new Error(`Unexpected call to getStepIdToSkipTo from step ${$.step.id}`)
}

/**
 * if-then FALSE: $.step is the if-then whose single-branch block is skipped.
 */
async function getIfThenStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<string | null> {
  // $.step is the trimmed execution object without `config` (global-variable.ts),
  // so the endStepId marker and approval config are read from the step's own DB
  // row (a full Objection Step).
  const flowSteps = await loadFlowSteps($)
  const ifThenStep = flowSteps.find((step) => step.id === $.step.id)

  // Legacy if-then (no endStepId marker in config) → depth-scan engine verbatim,
  // so pure-legacy flows stay byte-identical.
  if (!isIfThenV2(ifThenStep)) {
    return getIfThenV1StepIdToSkipTo($)
  }

  const endStep = resolveEndStepOrThrow(ifThenStep, flowSteps, $.flow.id)
  // Empty block (self-ref): getNextStep on the if-then is the same fall-through
  // as condition TRUE.
  // MRF rejection branch: getNextStep already stops at the branch edge, so a
  // block confined to one branch needs no special case here.
  return (await endStep.getNextStep())?.id ?? null
}

/**
 * only-continue-if FALSE: the nearest preceding if-then decides. With disjoint
 * ranges no earlier block can enclose a step the nearest one doesn't, so there
 * is no outward walk.
 */
async function getOnlyContinueIfStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<string | null> {
  const flowSteps = await loadFlowSteps($)
  const indexOfCurrentStep = flowSteps.findIndex(
    (step) => step.id === $.step.id,
  )
  const nearestPrecedingIfThen = flowSteps
    .slice(0, indexOfCurrentStep + 1)
    .reverse()
    .find((step) => isIfThenStep(step))

  // Not inside any if-then → stop (legacy-identical).
  if (!nearestPrecedingIfThen) {
    return null
  }

  // Legacy governing block → legacy engine verbatim (pure-legacy flows stay
  // byte-identical, including the quirky top-level-OCI jump-into-next-block case).
  if (!isIfThenV2(nearestPrecedingIfThen)) {
    return getIfThenV1StepIdToSkipTo($)
  }

  const endStep = resolveEndStepOrThrow(
    nearestPrecedingIfThen,
    flowSteps,
    $.flow.id,
  )

  const enclosesOci =
    nearestPrecedingIfThen.position < $.step.position &&
    $.step.position <= endStep.position
  if (!enclosesOci) {
    return null
  }
  return (await endStep.getNextStep())?.id ?? null
}

export async function getIfThenV1StepIdToSkipTo(
  $: IGlobalVariable,
): Promise<IStep['id']> {
  // PERF-FIXME: Objectionjs does no caching, so this will almost always be
  // queried multiple times by the same worker during a test run. If it does
  // turn out to impact perf, we can LRU memoize this by executionId.

  /**
   * We do this because this could be executed by only continue if, we
   * need to find the preceding if-then
   */

  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  // This should be position - 1 but we check in case position goes out of order
  const indexOfCurrentStep = flowSteps.findIndex(
    (step) => step.id === $.step.id,
  )

  if (indexOfCurrentStep !== $.step.position - 1) {
    // this is a sanity check to ensure the step is at the expected position
    console.error(
      `Bug: Current step ${$.step.id} is not at the expected position. The positioning of steps for flow ${$.flow.id} may be out of order.`,
    )
  }

  // search for immediate branch before current step
  const currBranchStep = flowSteps
    .slice(0, indexOfCurrentStep + 1)
    .reverse()
    .find((step) => step.appKey === 'toolbox' && step.key === 'ifThen')

  // only continue if step could be before any if-then branches
  if (!currBranchStep) {
    return null
  }

  let currDepth = parseInt(currBranchStep.parameters?.depth as string)

  if (isNaN(currDepth)) {
    logger.warn(
      `Branch depth for current branch step ${currBranchStep.id} is not defined for ${$.step.id}.`,
    )
    //  This an unreproducible bug where the depth is not defined for the step. since it's not possible to nest if-then at
    // this point of time, we default the depth to 0.
    currDepth = 0
  }

  // search for next branch after current step
  const nextBranchStep = flowSteps
    .slice(indexOfCurrentStep + 1)
    .find((step) => {
      if (!(step.appKey === 'toolbox' && step.key === 'ifThen')) {
        return false
      }

      let nextBranchDepth = parseInt(step.parameters?.depth as string)
      if (isNaN(nextBranchDepth)) {
        logger.warn(
          `Branch depth for future branch step ${$.step.id} is not defined.`,
        )
        // This an unreproducible bug where the depth is not defined for the step. since it's not possible to nest if-then at
        // this point of time, we default the depth to 0.
        nextBranchDepth = 0
      }
      return nextBranchDepth <= currDepth
    })

  if (!nextBranchStep) {
    return null
  }

  // To account for MRF flows: don't skip across approval/rejection branch boundaries,
  // or into a rejection branch belonging to a different MRF approval step.
  const currApproval = currBranchStep.config?.approval
  const nextApproval = nextBranchStep.config?.approval
  const isSameBranch =
    currApproval?.branch === 'reject' && nextApproval?.branch === 'reject'
      ? currApproval.stepId === nextApproval.stepId
      : currApproval?.branch !== 'reject' && nextApproval?.branch !== 'reject'

  return isSameBranch ? nextBranchStep.id : null
}
