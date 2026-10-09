import { isEmpty } from 'lodash'
import { raw } from 'objection'

import { remapEndStepIdsOnDuplicateFlow } from '@/apps/toolbox/common/validate-end-step'
import { getStepVersion } from '@/helpers/get-step-version'
import logger from '@/helpers/logger'
import { sanitizeCollaboratorDuplicatedParameters } from '@/helpers/sanitize-collaborator-duplicated-step'
import { updateStepVariables } from '@/helpers/update-duplicated-steps'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

// transaction does 2 things: update duplicate count for flow + duplicate flow + steps
const duplicateFlow: MutationResolvers['duplicateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const oldFlowId = params.input.id
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .withGraphFetched({ steps: { connection: true } })
    .findOne({ 'flows.id': oldFlowId })
    .throwIfNotFound()
  flow.steps.sort((a, b) => a.position - b.position)

  // Editors and Viewers must not receive the owner's connections or secrets.
  const isOwner = flow.role === 'owner'

  return await Flow.transaction(async (trx) => {
    const prevConfig = { ...flow.config }
    // A full config write would let a stale read overwrite owner settings.
    await flow.$query(trx).patch({
      config: raw(
        `jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{duplicateCount}',
          to_jsonb(COALESCE(config->>'duplicateCount', '0')::int + 1),
          true
        )`,
      ),
    })

    // duplicate the flow with the previous config (only keep notification frequency)
    delete prevConfig['duplicateCount']
    delete prevConfig['templateConfig']
    delete prevConfig['attachments']
    delete prevConfig['errorConfig']
    delete prevConfig['maxQps']
    delete prevConfig['isForceClogged']
    delete prevConfig['aiBuilderConfig']
    delete prevConfig['archiveDisabled']

    const duplicatedFlow = await context.currentUser
      .$relatedQuery('flows', trx)
      .insert({
        name: `[COPY] ${flow.name}`,
        active: false,
        config: isOwner && !isEmpty(prevConfig) ? prevConfig : undefined,
      })

    // duplicate the steps and the variables
    const oldToNewStepIdsMap: Record<string, string> = {}
    for (const oldStep of flow.steps) {
      // NOTE: should not duplicate connections that are shared
      // userId is null in connections if the connection was shared in a Pipe
      // and the pipe was subsequently transferred to another user
      const shouldDuplicateConnection =
        isOwner && oldStep.connection?.userId != null

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
      delete prevStepConfig['aiBuilderConfig']

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
            isOwner
              ? oldStep.parameters
              : sanitizeCollaboratorDuplicatedParameters(
                  oldStep.appKey,
                  oldStep.parameters,
                ),
            oldToNewStepIdsMap,
          ),
          config: !isEmpty(prevStepConfig) ? prevStepConfig : undefined,
          version: getStepVersion(oldStep.appKey, oldStep.key),
        })
      oldToNewStepIdsMap[oldStep.id] = duplicatedStep.id // update map after duplicating step
    }

    // endStepId is a forward reference, so remap it once every step has a copy.
    await remapEndStepIdsOnDuplicateFlow({
      trx,
      originalFlowId: oldFlowId,
      duplicatedFlowId: duplicatedFlow.id,
      sourceSteps: flow.steps,
      oldToNewStepIds: oldToNewStepIdsMap,
    })

    logger.info('Duplicate flow details', {
      event: 'duplicate-flow-request',
      originalFlow: oldFlowId,
      duplicatedFlow: duplicatedFlow.id,
      role: flow.role,
      stepsMapping: oldToNewStepIdsMap,
    })

    return duplicatedFlow
  })
}

export default duplicateFlow
