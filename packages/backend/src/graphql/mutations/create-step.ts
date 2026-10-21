import { IStepConfig } from '@plumber/types'

import { raw } from 'objection'

import { fixupEndStepOnCreateStep } from '@/apps/toolbox/actions/if-then/infra/handle-create-step'
import {
  extractSelfEndStepIntent,
  upgradeIfThenV1BlocksIfEnabled,
} from '@/apps/toolbox/common/validate-end-step'
import { BadUserInputError } from '@/errors/graphql-errors'
import { getStepVersion } from '@/helpers/get-step-version'
import logger from '@/helpers/logger'
import { validateApprovalConfig } from '@/helpers/validate-approval-config'
import App from '@/models/app'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const createStep: MutationResolvers['createStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  /**
   * appKey and key are optional, we allow creating of empty step for if-then branches
   */
  if (input.appKey && input.key) {
    const triggerOrAction = await App.findTriggerOrActionByKey(
      input.appKey,
      input.key,
    )

    if (!triggerOrAction) {
      logger.error({
        event: 'createStep: no such trigger or action',
        appKey: input.appKey,
        key: input.key,
      })
      throw new BadUserInputError('No such trigger or action')
    }

    if (triggerOrAction?.hiddenFromUser) {
      throw new BadUserInputError('Action can only be created by system')
    }
  }

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    // Put SELECTs in transaction just in case there's concurrent modification.
    const flow = await context.currentUser
      .withAccessibleFlows({ trx, requiredRole: 'editor' })
      .findOne({
        id: input.flow.id,
      })
      .throwIfNotFound()

    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    // if connectionId is specified, verify that the connection exists
    // and the user has the appropriate permissions to use it
    // user has to be an editor in the pipe
    if (input.connection?.id) {
      /**
       * NOTE: with collaborators,
       * Owner can use existing connections or add new connections to the pipe
       * Editor can only use existing connections that have been shared to the pipe
       * (TODO: phase 2) Editor will be able to add their own connections
       */
      await getConnection({
        context,
        connectionId: input.connection.id,
        flowId: flow.id,
        includeOwnConnections: flow.role === 'owner',
        trx,
      })
    }

    const previousStep = await flow
      .$relatedQuery('steps', trx)
      .findOne({
        id: input.previousStep.id,
      })
      .throwIfNotFound()

    const { config: newStepConfig, wantsSelfEndStep } =
      extractSelfEndStepIntent(input.config as IStepConfig)

    const validationResult = await validateApprovalConfig(
      newStepConfig,
      previousStep,
    )
    if (!validationResult.isApprovalConfigValid) {
      throw new BadUserInputError('Invalid approval config')
    }

    await flow
      .$relatedQuery('steps', trx)
      .patch({
        position: raw(`position + 1`),
      })
      .where('position', '>=', validationResult.newStepPosition)

    const version = getStepVersion(input.appKey, input.key)

    const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
      key: input.key,
      appKey: input.appKey,
      type: 'action',
      position: validationResult.newStepPosition,
      parameters: input.parameters,
      connectionId: input.connection?.id,
      config: newStepConfig,
      version,
    })

    // Opportunistically pins any other legacy if-then block, if the flag is
    // on for the pipe owner.
    // IMPORTANT: must run before validateEndStepOnCreateStep. Its rule 2
    // (tail-extend) only recognizes a block as extendable once it's explicit
    // V2, so pinning first lets a still-legacy tail-added block see its own
    // fresh pin and extend, instead of staying unmarked and being skipped.
    const preInsertSteps = (
      await flow.$relatedQuery('steps', trx).orderBy('position', 'asc')
    ).filter((flowStep) => flowStep.id !== step.id)
    await upgradeIfThenV1BlocksIfEnabled(trx, flow, preInsertSteps)

    // IMPORTANT: throws (and rolls back the whole creation) on any marker
    // violation.
    await fixupEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId: input.previousBlockId,
      previousStep,
      newStep: step,
      wantsSelfEndStep,
    })

    // NOTE: add flow connection to the flow_connections table
    // only add by default if the user is the owner of the flow
    // TODO (kevinkim-ogp): enhance this to allow editors to add connections
    if (input.connection?.id && flow.userId === context.currentUser.id) {
      await FlowConnections.addFlowConnection({
        flowId: flow.id,
        connectionId: input.connection.id,
        addedBy: context.currentUser.id,
        // it is always connection when creating a step since table is selected
        // only after the step is created
        connectionType: 'connection',
        trx,
      })
    }

    const updatedFlow = await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: context.currentUser.id,
      trx,
    })

    return {
      ...step,
      flowId: flow.id,
      flow: {
        updatedAt: updatedFlow.updatedAt,
      },
    }
  })
}

export default createStep
