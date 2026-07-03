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
  const step = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .findOne({
      'steps.id': stepId,
      'steps.flow_id': pipeId,
    })

  if (!step) {
    throw new Error('Step not found')
  }

  const triggerOrAction = await App.findTriggerOrActionByKey(
    step.appKey,
    step.key,
  )

  if (!triggerOrAction) {
    throw new Error('No such trigger or action')
  }

  if (step.type === 'action') {
    const action = triggerOrAction as IAction
    if (action.hiddenFromUser) {
      throw new Error('Action can only be updated by system')
    }
  }

  const rawApp = apps[step.appKey]
  const rawTriggerOrAction = (
    step.type === 'trigger'
      ? rawApp?.triggers?.find((t) => t.key === step.key)
      : rawApp?.actions?.find((a) => a.key === step.key)
  ) as IRawAction | IRawTrigger | undefined

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

  if (step.type === 'action') {
    const action = triggerOrAction as IAction
    action.validateStepParameters?.(patchedParameters)
  }

  const mergedParameters = {
    ...(step.parameters ?? {}),
    ...patchedParameters,
  } as IJSONObject

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
  const updatedStep = await Step.query().patchAndFetchById(stepId, {
    parameters: mergedParameters,
    version,
    status: 'incomplete',
  })

  const resolvedConnectionId = connectionId
  const result: McpUpdateStepParametersResult = { step: updatedStep }

  if (resolvedConnectionId !== undefined) {
    const registrationType = rawApp?.auth?.connectionRegistrationType

    if (registrationType === 'per-step') {
      try {
        const verification = await verifyConnectionRegistrationService(
          user,
          stepId,
          resolvedConnectionId,
        )

        if (verification.status === 'VERIFIED') {
          await Step.query().findById(stepId).patch({
            connectionId: resolvedConnectionId,
          })
          result.step.connectionId = resolvedConnectionId
          result.connectionRegistered = true
        } else if (verification.status === 'UNREGISTERED') {
          await registerConnectionService(user, stepId, resolvedConnectionId)
          result.step.connectionId = resolvedConnectionId
          result.connectionRegistered = true
        } else {
          result.connectionConflict = true
          result.connectionConflictMessage = verification.message
          try {
            const schema = await fetchFormSchemaForStep(
              user,
              stepId,
              resolvedConnectionId,
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
            resolvedConnectionId,
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
          resolvedConnectionId,
        )
        if (verification.status !== 'VERIFIED') {
          await registerConnectionService(user, stepId, resolvedConnectionId)
        } else {
          await Step.query().findById(stepId).patch({
            connectionId: resolvedConnectionId,
          })
        }
        result.step.connectionId = resolvedConnectionId
        result.connectionRegistered = true
      } catch (err) {
        result.connectionError =
          err instanceof Error ? err.message : String(err)
      }
    } else {
      await Step.query().findById(stepId).patch({
        connectionId: resolvedConnectionId,
      })
      result.step.connectionId = resolvedConnectionId
    }
  }

  return result
}
