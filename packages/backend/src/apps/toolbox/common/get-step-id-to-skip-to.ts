import type { IGlobalVariable, IStep } from '@plumber/types'

import logger from '@/helpers/logger'
import Step from '@/models/step'

import {
  IF_THEN_END_STEP_ID_PARAM,
  isIfThenStep,
  isNewStyleIfThen,
} from './constants'

async function loadFlowSteps($: IGlobalVariable): Promise<Step[]> {
  return Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()
}

/**
 * Resolves the last step (inclusive) of a new-style if-then block, failing loud
 * on a corrupt marker: a dangling id, or an endStep positioned before the
 * if-then itself. Never silently degrades — a bad marker is a data bug.
 */
function resolveEndStepOrThrow(
  ifThen: { id: string; position: number; endStepId: string },
  flowSteps: Step[],
  flowId: string,
): Step {
  const endStep = flowSteps.find((step) => step.id === ifThen.endStepId)
  if (!endStep) {
    logger.error({
      event: 'if-then-dangling-end-step',
      ifThenStepId: ifThen.id,
      endStepId: ifThen.endStepId,
      flowId,
    })
    throw new Error(
      `If-then step ${ifThen.id} has a dangling endStepId ${ifThen.endStepId}`,
    )
  }
  if (endStep.position < ifThen.position) {
    logger.error({
      event: 'if-then-end-step-before-self',
      ifThenStepId: ifThen.id,
      endStepId: ifThen.endStepId,
      endStepPosition: endStep.position,
      ifThenPosition: ifThen.position,
      flowId,
    })
    throw new Error(
      `If-then step ${ifThen.id} has an endStepId ${ifThen.endStepId} positioned before itself`,
    )
  }
  return endStep
}

/**
 * Resolves the step id execution should resume at when a conditional block
 * (if-then or only-continue-if) evaluates to FALSE. Returns null to stop
 * execution — the same contract the action files map today.
 *
 * The mode is derived from $.step: an if-then resolves its own block; anything
 * else (only-continue-if) backward-scans for the governing if-then. Legacy
 * (marker-less) if-thens delegate to the depth-scan engine verbatim, so
 * pure-legacy flows stay byte-identical.
 */
export async function getStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<string | null> {
  // if-then FALSE: $.step is the if-then whose single-branch block is skipped.
  if (isIfThenStep($.step)) {
    // Legacy if-then (no endStepId marker) → depth-scan engine, verbatim. Read
    // presence straight off $.step so this common path keeps a single query.
    if (!isNewStyleIfThen($.step)) {
      return getBranchStepIdToSkipTo_LEGACY($)
    }

    const flowSteps = await loadFlowSteps($)

    // A new-style if-then must never carry approval config (writes are guarded).
    // config is not carried on $.step, so read it off the DB row. If a corrupt
    // one reaches here, degrade loudly to the legacy engine rather than throw —
    // throwing would brick production MRF pipes.
    const selfRow = flowSteps.find((step) => step.id === $.step.id)
    if (selfRow?.config?.approval) {
      logger.error({
        event: 'if-then-end-step-on-approval-branch',
        ifThenStepId: $.step.id,
        flowId: $.flow.id,
      })
      return getBranchStepIdToSkipTo_LEGACY($)
    }

    const endStep = resolveEndStepOrThrow(
      {
        id: $.step.id,
        position: $.step.position,
        endStepId: $.step.parameters[IF_THEN_END_STEP_ID_PARAM] as string,
      },
      flowSteps,
      $.flow.id,
    )
    // Empty block (self-ref) falls out naturally: getNextStep on the if-then
    // itself is the positional fall-through, identical to condition TRUE.
    return (await endStep.getNextStep())?.id ?? null
  }

  // only-continue-if FALSE: the nearest preceding if-then decides. With disjoint
  // ranges no earlier block can enclose a step the nearest one doesn't, so there
  // is no outward walk.
  const flowSteps = await loadFlowSteps($)
  const indexOfCurrentStep = flowSteps.findIndex(
    (step) => step.id === $.step.id,
  )
  const governingIfThen = flowSteps
    .slice(0, indexOfCurrentStep + 1)
    .reverse()
    .find((step) => isIfThenStep(step))

  // Not inside any if-then → stop (legacy-identical).
  if (!governingIfThen) {
    return null
  }

  // Legacy governing block → legacy engine verbatim (pure-legacy flows stay
  // byte-identical, including the quirky top-level-OCI jump-into-next-block case).
  if (!isNewStyleIfThen(governingIfThen)) {
    return getBranchStepIdToSkipTo_LEGACY($)
  }

  // Corrupt new-style + approval → legacy fallback (loud degrade).
  if (governingIfThen.config?.approval) {
    logger.error({
      event: 'if-then-end-step-on-approval-branch',
      ifThenStepId: governingIfThen.id,
      flowId: $.flow.id,
    })
    return getBranchStepIdToSkipTo_LEGACY($)
  }

  const endStep = resolveEndStepOrThrow(
    {
      id: governingIfThen.id,
      position: governingIfThen.position,
      endStepId: governingIfThen.parameters[
        IF_THEN_END_STEP_ID_PARAM
      ] as string,
    },
    flowSteps,
    $.flow.id,
  )

  // Block-scoped abort: resume after the endStep iff the block encloses this
  // only-continue-if; else stop ("not inside any block").
  const enclosesOci =
    governingIfThen.position < $.step.position &&
    $.step.position <= endStep.position
  if (!enclosesOci) {
    return null
  }
  return (await endStep.getNextStep())?.id ?? null
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export async function getBranchStepIdToSkipTo_LEGACY(
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
