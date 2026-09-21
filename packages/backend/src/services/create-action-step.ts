import type { IJSONObject, IStepConfig } from '@plumber/types'

import { raw, type Transaction } from 'objection'

import { getStepVersion } from '@/helpers/get-step-version'
import { validateApprovalConfig } from '@/helpers/validate-approval-config'
import type Flow from '@/models/flow'
import Step from '@/models/step'

export interface CreateActionStepCoreInput {
  trx: Transaction
  flow: Flow
  previousStep: Step
  appKey: string
  key: string
  parameters?: IJSONObject
  config?: IStepConfig
  connectionId?: string
}

export class InvalidApprovalConfigError extends Error {}

/**
 * Shared by the GraphQL createStep resolver and the AI Builder's create_step
 * MCP tool, so approval-branch position math (see validateApprovalConfig)
 * can't drift between the two independently-maintained call sites.
 */
export async function createActionStepCore({
  trx,
  flow,
  previousStep,
  appKey,
  key,
  parameters,
  config,
  connectionId,
}: CreateActionStepCoreInput): Promise<Step> {
  const validationResult = await validateApprovalConfig(
    config ?? {},
    previousStep,
    trx,
  )
  if (!validationResult.isApprovalConfigValid) {
    throw new InvalidApprovalConfigError('Invalid approval config')
  }

  await flow
    .$relatedQuery('steps', trx)
    .patch({ position: raw('position + 1') })
    .where('position', '>=', validationResult.newStepPosition)

  return flow.$relatedQuery('steps', trx).insertAndFetch({
    key,
    appKey,
    type: 'action',
    position: validationResult.newStepPosition,
    parameters: parameters ?? {},
    connectionId,
    config: config ?? {},
    version: getStepVersion(appKey, key),
  })
}
