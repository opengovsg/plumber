import { Knex } from 'knex'
import { isEmpty } from 'lodash'

import { getStepVersion } from '@/helpers/get-step-version'
import logger from '@/helpers/logger'
import { updateStepVariables } from '@/helpers/update-duplicated-steps'
import Flow from '@/models/flow'
import Step from '@/models/step'

import { MutationResolvers } from '../__generated__/types.generated'

// transaction does 2 things: update duplicate count for flow + duplicate flow + steps
const duplicateFlow: MutationResolvers['duplicateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const oldFlowId = params.input.id
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphJoined('[steps.[connection]]')
    .orderBy('steps.position', 'asc')
    .findOne({ 'flows.id': oldFlowId })
    .throwIfNotFound()

  return await Flow.transaction(async (trx) => {
    const prevConfig = { ...flow.config }
    // update duplicate count for the original flow
    await flow.$query(trx).patch({
      config: {
        ...prevConfig,
        duplicateCount: flow.config?.duplicateCount
          ? flow.config.duplicateCount + 1
          : 1,
      },
    })

    // duplicate the flow with the previous config (only keep notification frequency)
    delete prevConfig['duplicateCount']
    delete prevConfig['templateConfig']
    delete prevConfig['attachments']
    delete prevConfig['errorConfig']
    delete prevConfig['maxQps']

    const duplicatedFlow = await context.currentUser
      .$relatedQuery('flows', trx)
      .insert({
        name: `[COPY] ${flow.name}`,
        active: false,
        config: !isEmpty(prevConfig) ? prevConfig : undefined,
      })

    // duplicate the steps and the variables
    const oldToNewStepIdsMap: Record<string, string> = {}
    for (const oldStep of flow.steps) {
      // NOTE: should not duplicate connections that are shared
      // userId is null in connections if the connection was shared in a Pipe
      // and the pipe was subsequently transferred to another user
      const shouldDuplicateConnection = oldStep.connection?.userId != null

      const prevStepConfig = {
        ...oldStep.config,
        ...(oldStep.config?.approval && {
          approval: {
            ...oldStep.config.approval,
            stepId: oldToNewStepIdsMap[oldStep.config.approval.stepId],
          },
        }),
      }

      delete prevStepConfig['templateConfig']
      delete prevStepConfig['adminOverride']

      const duplicatedStep = await duplicatedFlow
        .$relatedQuery('steps', trx)
        .insert({
          key: oldStep.key,
          appKey: oldStep.appKey,
          type: oldStep.type,
          connectionId: shouldDuplicateConnection ? oldStep.connectionId : null,
          connection: shouldDuplicateConnection ? oldStep.connection : null,
          position: oldStep.position,
          parameters: updateStepVariables(
            oldStep.parameters,
            oldToNewStepIdsMap,
          ),
          config: !isEmpty(prevStepConfig) ? prevStepConfig : undefined,
          version: getStepVersion(oldStep.appKey, oldStep.key),
        })
      oldToNewStepIdsMap[oldStep.id] = duplicatedStep.id // update map after duplicating step
    }

    // Keep each if-then branch's step to jump to valid in the copy.
    await remapBranchJumpTargets(trx, flow.steps, oldToNewStepIdsMap, {
      oldFlowId,
      newFlowId: duplicatedFlow.id,
    })

    logger.info('Duplicate flow details', {
      event: 'duplicate-flow-request',
      originalFlow: oldFlowId,
      duplicatedFlow: duplicatedFlow.id,
      stepsMapping: oldToNewStepIdsMap,
    })

    return duplicatedFlow
  })
}

/**
 * Remaps every if-then branch's step to jump to (parameters.stepIdToJumpTo)
 * onto the duplicated step ids, in a single UPDATE.
 *
 * Unlike config.approval.stepId (a backward reference to an already-duplicated
 * step), this target points forward — to the next if-then or the first single
 * step after the block — so it can only be resolved once every step has a new
 * id. updateStepVariables leaves the raw id untouched (it isn't a `step.<id>.`
 * variable reference), so we translate it here. A dangling target throws, so the
 * surrounding transaction rolls back rather than persisting a broken copy.
 */
async function remapBranchJumpTargets(
  trx: Knex.Transaction,
  oldSteps: Step[],
  oldToNewStepIdsMap: Record<string, string>,
  flowIds: { oldFlowId: string; newFlowId: string },
): Promise<void> {
  const remaps: Array<{ newStepId: string; newJumpTo: string }> = []
  for (const oldStep of oldSteps) {
    const oldJumpTo = oldStep.parameters?.stepIdToJumpTo
    if (typeof oldJumpTo !== 'string') {
      continue
    }

    const newJumpTo = oldToNewStepIdsMap[oldJumpTo]
    if (!newJumpTo) {
      logger.error('Could not remap stepIdToJumpTo while duplicating flow', {
        event: 'duplicate-flow-bad-step-id-to-jump-to',
        originalFlow: flowIds.oldFlowId,
        duplicatedFlow: flowIds.newFlowId,
        oldStepId: oldStep.id,
        oldJumpTo,
      })
      throw new Error(
        `Could not remap stepIdToJumpTo "${oldJumpTo}" for step ${oldStep.id} while duplicating flow ${flowIds.oldFlowId}`,
      )
    }

    remaps.push({ newStepId: oldToNewStepIdsMap[oldStep.id], newJumpTo })
  }

  if (remaps.length === 0) {
    return
  }

  // A single UPDATE ... FROM (VALUES ...) join, rather than one UPDATE per branch.
  const valuesPlaceholders = remaps.map(() => '(?, ?)').join(', ')
  await trx.raw(
    `UPDATE steps AS s
     SET parameters = jsonb_set(s.parameters, '{stepIdToJumpTo}', to_jsonb(v.new_jump_to::text), true)
     FROM (VALUES ${valuesPlaceholders}) AS v(step_id, new_jump_to)
     WHERE s.id = v.step_id::uuid`,
    remaps.flatMap((remap) => [remap.newStepId, remap.newJumpTo]),
  )
}

export default duplicateFlow
