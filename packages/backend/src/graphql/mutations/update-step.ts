import { isEqual } from 'lodash'
import { raw, ValidationError } from 'objection'

import { IAction } from '@/../../types'
import apps from '@/apps'
import { getEndStepConfigForUpdateStep } from '@/apps/toolbox/actions/if-then/infra/handle-update-step'
import { BLOCK_END_STEP_ID } from '@/apps/toolbox/common/constants'
import { BadUserInputError } from '@/errors/graphql-errors'
import {
  addFlowConnection,
  addFlowTableConnection,
} from '@/helpers/add-flow-connection'
import logger from '@/helpers/logger'
import App from '@/models/app'
import Step from '@/models/step'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: NonNullable<MutationResolvers['updateStep']> = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }
  const {
    id,
    appKey,
    key,
    connection: inputConnection,
    flow: inputFlow,
    parameters: inputParameters,
  } = input
  if (!id) {
    throw new BadUserInputError('Missing id')
  }
  if (!appKey || !key) {
    throw new BadUserInputError('Missing appKey or key')
  }
  if (!inputConnection) {
    throw new BadUserInputError('Missing connection')
  }
  if (!inputFlow?.id || !inputFlow.updatedAt) {
    throw new BadUserInputError('Missing flow')
  }
  if (!inputParameters) {
    throw new BadUserInputError('Missing parameters')
  }
  const flowId = inputFlow.id
  const flowUpdatedAt = inputFlow.updatedAt

  const triggerOrAction = await App.findTriggerOrActionByKey(appKey, key)
  if (!triggerOrAction) {
    logger.error({
      event: 'updateStep: no such trigger or action',
      appKey,
      key,
    })
    throw new BadUserInputError('No such trigger or action')
  }

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .findOne({
        'steps.id': id,
        'steps.flow_id': flowId,
      })

    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    step.flow.assertNotUpdatedSince(flowUpdatedAt, context.currentUser.id)

    if (step.type === 'action' && (triggerOrAction as IAction).hiddenFromUser) {
      throw new BadUserInputError('Action can only be updated by system')
    }

    if (step.flow.active) {
      // FormSG workflow steps take their names from the form.
      if (step.appKey === 'formsg' && step.parameters?.mrf) {
        throw new BadUserInputError(
          'FormSG workflow step names cannot be changed',
        )
      }

      const newStepName = input.config?.stepName
      const inputEndStepId = input.config?.[BLOCK_END_STEP_ID]
      const isRenameOnly =
        newStepName !== undefined &&
        newStepName !== null &&
        input.status !== 'incomplete' &&
        step.key === key &&
        step.appKey === appKey &&
        (step.connectionId ?? null) === (inputConnection.id ?? null) &&
        isEqual(step.parameters ?? {}, inputParameters) &&
        (inputEndStepId === undefined ||
          inputEndStepId === step.config?.[BLOCK_END_STEP_ID])

      if (!isRenameOnly) {
        throw new ValidationError({
          message: 'Cannot edit published pipe.',
          type: 'editingPublishedPipeError',
        })
      }

      // IMPORTANT: patch only stepName against the current row. Spreading the
      // fetched config can restore an endStepId that a concurrent delete repaired.
      const renamedStep = await Step.query(trx)
        .context({ shouldBypassBeforeUpdateHook: true })
        .patchAndFetchById(id, {
          updatedBy: context.currentUser.id,
          config: raw(
            `jsonb_set(coalesce(config, '{}'::jsonb), '{stepName}', to_jsonb(?::text))`,
            [newStepName],
          ),
        })
        .withGraphFetched({ connection: true, flow: true })

      const flowAfterRename = await step.flow.patchLastUpdated({
        flowId: step.flowId,
        updatedBy: context.currentUser.id,
        trx,
      })
      renamedStep.flow.updatedAt = flowAfterRename.updatedAt
      renamedStep.flow.updatedBy = context.currentUser.id
      return renamedStep
    }

    if (inputConnection.id) {
      // if connectionId is specified, verify that the connection exists
      // this prevents editors from adding their own connections, only flow connections can be added
      const connection = await getConnection({
        context,
        connectionId: inputConnection.id,
        flowId,
        includeOwnConnections: step.flow.role === 'owner',
        trx,
      })

      // we check that the connection exists and is the same app
      if (!connection || connection.key !== appKey) {
        throw new BadUserInputError('Connection not found')
      }
    }

    // NOTE: we use this function to first validate the step parameters
    // to avoid misuse and saving invalid step parameters
    if (step.type === 'action') {
      const action = triggerOrAction as IAction
      action?.validateStepParameters?.(inputParameters)
    }

    const shouldInvalidate =
      step.key !== key ||
      step.appKey !== appKey ||
      input.status === 'incomplete'

    const stepName = input?.config?.stepName ?? step?.config?.stepName
    const existingConfig = step?.config ?? {}

    // Returns {} when absent so the config spread below preserves any existing
    // marker; throws (rolls back) on an invalid target.
    const endStepConfig = await getEndStepConfigForUpdateStep({
      trx,
      step,
      inputConfig: input.config,
      flowId,
    })

    let parameters = inputParameters
    let version = step.version

    // transform the parameters if the step has a stepTransformer
    const transformer = apps[appKey]?.stepTransformer
    if (transformer) {
      parameters = transformer.transformStepParameters(
        key,
        inputParameters,
        version,
      )
      version = transformer.getLatestStepVersion(key)
    }

    const updatedStep = await Step.query(trx)
      .patchAndFetchById(id, {
        key,
        appKey,
        connectionId: inputConnection.id,
        parameters,
        version,
        status: shouldInvalidate ? 'incomplete' : step.status,
        updatedBy: context.currentUser.id,
        config: {
          ...existingConfig,
          // NOTE: check for undefined to allow empty string, which defaults to the action/trigger name
          ...(stepName !== undefined ? { stepName } : {}),
          ...endStepConfig,
        },
      })
      .withGraphFetched({
        connection: true,
        flow: true,
      })

    /**
     * NOTE: we need to update flow connections for apps with connections:
     * Tiles:
     * 1. add the tile to the flow connections table
     * 2. add the collaborator to the table collaborators table
     *
     * Other connections:
     * 1. add the connection to the flow connections table
     */
    const updatedAppKey = updatedStep?.appKey

    // tiles special handling
    if (updatedAppKey === 'tiles' && updatedStep?.parameters?.tableId) {
      await addFlowTableConnection({
        flowId: updatedStep.flowId,
        tableId: updatedStep.parameters.tableId as string,
        addedBy: context.currentUser.id,
        flowOwnerId: step.flow.userId,
        trx,
      })
    } else if (step.flow.role === 'owner' && updatedStep?.connectionId) {
      await addFlowConnection({
        step: updatedStep,
        addedBy: context.currentUser.id,
        trx,
      })
    }

    // update the flow's last updated
    const updatedFlow = await step.flow.patchLastUpdated({
      flowId: step.flowId,
      updatedBy: context.currentUser.id,
      trx,
    })

    // do this instead of spreading the updatedStep so that it preserves the Model instance
    updatedStep.flow.updatedAt = updatedFlow.updatedAt
    updatedStep.flow.updatedBy = context.currentUser.id
    return updatedStep
  })

  return step
}

export default updateStep
