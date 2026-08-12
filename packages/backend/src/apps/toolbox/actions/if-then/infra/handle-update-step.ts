import { Transaction } from 'objection'

import { BLOCK_END_STEP_ID } from '@/apps/toolbox/common/constants'
import { validateEndStepWrite } from '@/apps/toolbox/common/validate-end-step'
import Step from '@/models/step'

/**
 * Derives a client-supplied config.endStepId on updateStep into the config
 * fragment for the caller to merge into its own patch.
 *
 * Accepted only when the key is present — an absent key is preserved by the
 * caller's config spread. Throws (rolling back the transaction) on an invalid
 * target.
 */
export async function getEndStepConfigForUpdateStep({
  trx,
  step,
  inputConfig,
  flowId,
}: {
  trx: Transaction
  step: Step
  inputConfig: { [BLOCK_END_STEP_ID]?: string | null } | null | undefined
  flowId: string
}): Promise<{ [BLOCK_END_STEP_ID]?: string }> {
  if (!inputConfig || !Object.hasOwn(inputConfig, BLOCK_END_STEP_ID)) {
    return {}
  }

  const endStepId = inputConfig[BLOCK_END_STEP_ID] as string
  const flowSteps = await Step.query(trx)
    .where('flow_id', flowId)
    .orderBy('position', 'asc')
  validateEndStepWrite({ flowSteps, ifThenStepId: step.id, endStepId, flowId })
  return { [BLOCK_END_STEP_ID]: endStepId }
}
