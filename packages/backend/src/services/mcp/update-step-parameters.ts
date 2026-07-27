import type {
  IAction,
  IJSONObject,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import apps from '@/apps'
import App from '@/models/app'
import Step from '@/models/step'
import type User from '@/models/user'

export interface UpdateStepParametersInput {
  user: User
  pipeId: string
  stepId: string
  parameters: Record<string, unknown>
  connectionId?: string
}

export async function updateStepParametersService({
  user,
  pipeId,
  stepId,
  parameters,
  connectionId,
}: UpdateStepParametersInput): Promise<Step> {
  return Step.transaction(async (trx) => {
    const accessible = await user
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .findOne({
        'steps.id': stepId,
        'steps.flow_id': pipeId,
      })

    if (!accessible) {
      throw new Error('Step not found')
    }

    // Re-fetch with a row lock to serialise concurrent tool calls for the same
    // step. forUpdate() cannot be used on the withAccessibleSteps query
    // directly because it has a LEFT JOIN, which PostgreSQL prohibits locking.
    const step = await Step.query(trx).forUpdate().findById(stepId)
    if (!step) {
      throw new Error('Step cannot be updated')
    }

    // Use App.findTriggerOrActionByKey for type/validity checks
    const triggerOrAction = await App.findTriggerOrActionByKey(
      step.appKey,
      step.key,
    )

    if (!triggerOrAction) {
      throw new Error('No such trigger or action')
    }

    if (triggerOrAction.hiddenFromUser) {
      throw new Error(
        `${
          step.type === 'trigger' ? 'Trigger' : 'Action'
        } can only be updated by system`,
      )
    }

    // Get arguments from the raw app registry (before getApp transforms them into substeps)
    const rawApp = apps[step.appKey]
    const rawTriggerOrAction = (
      step.type === 'trigger'
        ? rawApp?.triggers?.find((t) => t.key === step.key)
        : rawApp?.actions?.find((a) => a.key === step.key)
    ) as IRawAction | IRawTrigger | undefined

    // Silently drop any keys not in this action/trigger's declared argument schema
    const allowedKeys = new Set(
      (rawTriggerOrAction?.arguments ?? []).map((f) => f.key),
    )
    const filteredParameters = Object.fromEntries(
      Object.entries(parameters).filter(([k]) => allowedKeys.has(k)),
    ) as IJSONObject

    let patchedParameters = filteredParameters
    let version = step.version

    const transformer = apps[step.appKey]?.stepTransformer
    if (transformer) {
      patchedParameters = transformer.transformStepParameters(
        step.key,
        filteredParameters,
        version,
      ) as IJSONObject
      version = transformer.getLatestStepVersion(step.key)
    }

    // Merge so repeated tool calls (one param at a time) accumulate rather than overwrite.
    const mergedParameters = {
      ...(step.parameters ?? {}),
      ...patchedParameters,
    } as IJSONObject

    if (step.type === 'action') {
      const action = triggerOrAction as IAction
      action.validateStepParameters?.(mergedParameters)
    }

    if (connectionId !== undefined) {
      const connection = await user
        .withAccessibleConnections({ requiredRole: 'viewer' })
        .findOne({ 'connections.id': connectionId })

      if (!connection) {
        throw new Error('Connection not found')
      }

      if (connection.key !== step.appKey) {
        throw new Error(
          `Connection app '${connection.key}' does not match step app '${step.appKey}'`,
        )
      }
    }

    return Step.query(trx).patchAndFetchById(stepId, {
      parameters: mergedParameters,
      version,
      status: 'incomplete',
      ...(connectionId !== undefined && { connectionId }),
    })
  })
}
