import type {
  IAction,
  IJSONObject,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import apps from '@/apps'
import { parseFormIdFormat } from '@/apps/formsg/auth/verify-credentials'
import type { FormSchema } from '@/apps/formsg/common/types'
import { fetchFormSchema } from '@/apps/formsg/triggers/new-submission/fetch-form-schema'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

import { registerConnectionService } from './register-connection'
import { verifyConnectionRegistrationService } from './verify-connection-registration'

export interface UpdateStepParametersInput {
  user: User
  pipeId: string
  stepId: string
  parameters: Record<string, unknown>
  connectionId?: string
}

export interface FormField {
  id: string
  title: string
  fieldType: string
}

export interface McpUpdateStepParametersResult {
  step: Step
  connectionRegistered?: boolean
  connectionConflict?: boolean
  connectionConflictMessage?: string
  connectionError?: string
  formFields?: FormField[]
}

async function fetchFormSchemaForStep(
  user: User,
  stepId: string,
  connectionId: string,
): Promise<FormSchema> {
  const step = await Step.query().findById(stepId)
  if (!step) {
    throw new Error('Step not found')
  }

  const connection = await Connection.query().findById(connectionId)
  if (!connection) {
    throw new Error('Connection not found')
  }

  const app = apps[step.appKey ?? '']
  if (!app) {
    throw new Error('App not found')
  }

  const flow = await Flow.query().findById(step.flowId)
  if (!flow) {
    throw new Error('Flow not found')
  }

  const $ = await globalVariable({ connection, app, flow, user })
  const formId = parseFormIdFormat($)
  if (!formId) {
    throw new Error('Form ID not found in connection auth data')
  }

  return fetchFormSchema($, formId)
}

export async function updateStepParametersService({
  user,
  pipeId,
  stepId,
  parameters,
  connectionId,
}: UpdateStepParametersInput): Promise<McpUpdateStepParametersResult> {
  const { step, rawApp } = await Step.transaction(async (trx) => {
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

    const transformer = rawApp?.stepTransformer
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

    // Write parameters without connectionId; connectionId is set only after registration succeeds
    const updatedStep = await Step.query(trx).patchAndFetchById(stepId, {
      parameters: mergedParameters,
      version,
      status: 'incomplete',
    })

    return { step: updatedStep, rawApp }
  })

  const result: McpUpdateStepParametersResult = { step }

  if (connectionId !== undefined) {
    const registrationType = rawApp?.auth?.connectionRegistrationType

    if (registrationType === 'per-step') {
      try {
        const verification = await verifyConnectionRegistrationService(
          user,
          stepId,
          connectionId,
        )

        if (verification.status === 'VERIFIED') {
          await Step.query()
            .patchAndFetchById(stepId, { connectionId })
            .throwIfNotFound()
          result.step.connectionId = connectionId
          result.connectionRegistered = true
        } else if (verification.status === 'UNREGISTERED') {
          await registerConnectionService(user, stepId, connectionId)
          result.step.connectionId = connectionId
          result.connectionRegistered = true
        } else {
          result.connectionConflict = true
          result.connectionConflictMessage = verification.message
          try {
            const schema = await fetchFormSchemaForStep(
              user,
              stepId,
              connectionId,
            )
            result.formFields = schema.form.form_fields.map((f) => ({
              id: f._id,
              title: f.title,
              fieldType: f.fieldType,
            }))
          } catch {
            // formFields is best-effort
          }
        }
      } catch (err) {
        result.connectionError =
          err instanceof Error ? err.message : String(err)
        try {
          const schema = await fetchFormSchemaForStep(
            user,
            stepId,
            connectionId,
          )
          result.formFields = schema.form.form_fields.map((f) => ({
            id: f._id,
            title: f.title,
            fieldType: f.fieldType,
          }))
        } catch {
          // best-effort
        }
      }
    } else if (registrationType === 'global') {
      try {
        const verification = await verifyConnectionRegistrationService(
          user,
          stepId,
          connectionId,
        )
        if (verification.status !== 'VERIFIED') {
          await registerConnectionService(user, stepId, connectionId)
        } else {
          await Step.query()
            .patchAndFetchById(stepId, { connectionId })
            .throwIfNotFound()
        }
        result.step.connectionId = connectionId
        result.connectionRegistered = true
      } catch (err) {
        result.connectionError =
          err instanceof Error ? err.message : String(err)
      }
    } else {
      await Step.query()
        .patchAndFetchById(stepId, { connectionId })
        .throwIfNotFound()
      result.step.connectionId = connectionId
    }
  }

  return result
}
