import { IStepConfig } from '@plumber/types'

import { fixupEndStepOnCreateStep } from '@/apps/toolbox/actions/if-then/infra/handle-create-step'
import {
  extractSelfEndStepIntent,
  upgradeIfThenV1Blocks,
} from '@/apps/toolbox/common/validate-end-step'
import { BadUserInputError } from '@/errors/graphql-errors'
import { addFlowConnection } from '@/helpers/add-flow-connection'
import logger from '@/helpers/logger'
import { isConnectionFieldSharedWithFlow } from '@/helpers/shared-connection-field'
import App from '@/models/app'
import Step from '@/models/step'
import { getConnection } from '@/services/connection'
import {
  createActionStepCore,
  InvalidApprovalConfigError,
} from '@/services/create-action-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const createStep: NonNullable<MutationResolvers['createStep']> = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }
  const flowId = input.flow?.id
  const flowUpdatedAt = input.flow?.updatedAt
  const previousStepId = input.previousStep?.id
  if (!flowId || !flowUpdatedAt) {
    throw new BadUserInputError('Missing flow')
  }
  if (!previousStepId) {
    throw new BadUserInputError('Missing previousStep')
  }

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
        id: flowId,
      })
      .throwIfNotFound()

    flow.assertNotUpdatedSince(flowUpdatedAt, context.currentUser.id)

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

    if (
      flow.role !== 'owner' &&
      !(await isConnectionFieldSharedWithFlow({
        flowId: flow.id,
        appKey: input.appKey,
        connectionId: input.connection?.id,
        parameters: input.parameters,
        trx,
      }))
    ) {
      throw new BadUserInputError('Selected file is not shared with this pipe')
    }

    const previousStep = await flow
      .$relatedQuery('steps', trx)
      .findOne({
        id: previousStepId,
      })
      .throwIfNotFound()

    const { config: newStepConfig, wantsSelfEndStep } =
      extractSelfEndStepIntent(input.config as IStepConfig)

    let step: Step
    try {
      step = await createActionStepCore({
        trx,
        flow,
        previousStep,
        appKey: input.appKey ?? undefined,
        key: input.key ?? undefined,
        parameters: input.parameters ?? undefined,
        config: newStepConfig,
        connectionId: input.connection?.id ?? undefined,
      })
    } catch (error) {
      if (error instanceof InvalidApprovalConfigError) {
        throw new BadUserInputError('Invalid approval config')
      }
      throw error
    }

    // Opportunistically pins any other legacy if-then block.
    const upgradeLegacyBlocks = async () => {
      const preInsertSteps = (
        await flow.$relatedQuery('steps', trx).orderBy('position', 'asc')
      ).filter((flowStep) => flowStep.id !== step.id)
      await upgradeIfThenV1Blocks(trx, flow, preInsertSteps)
    }
    // IMPORTANT: throws (and rolls back the whole creation) on any marker
    // violation.
    const fixupEndStep = () =>
      fixupEndStepOnCreateStep({
        trx,
        flow,
        previousBlockId: input.previousBlockId,
        previousStep,
        newStep: step,
        wantsSelfEndStep,
      })

    // Rule 1 (add after a block) pins its own block. Upgrading first could
    // delete a blank previousStep and pin the block to the new step instead.
    // Rule 2 (tail-extend) only extends an explicit V2 block, so it needs the
    // upgrade first.
    if (input.previousBlockId != null) {
      await fixupEndStep()
      await upgradeLegacyBlocks()
    } else {
      await upgradeLegacyBlocks()
      await fixupEndStep()
    }

    // NOTE: add flow connection to the flow_connections table
    // only add by default if the user is the owner of the flow
    // TODO (kevinkim-ogp): enhance this to allow editors to add connections
    if (input.connection?.id && flow.userId === context.currentUser.id) {
      await addFlowConnection({
        step,
        addedBy: context.currentUser.id,
        trx,
      })
    }

    const updatedFlow = await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: context.currentUser.id,
      trx,
    })

    // Blank placeholder cleanup can shift this step's position after insert.
    const persistedStep = await step.$query(trx)

    return {
      ...persistedStep,
      flowId: flow.id,
      flow: {
        updatedAt: updatedFlow.updatedAt,
      },
    }
  })
}

export default createStep
