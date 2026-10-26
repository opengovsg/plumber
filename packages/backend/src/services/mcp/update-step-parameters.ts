import type { IJSONObject, IRawAction } from '@plumber/types'
import { NotFoundError } from 'objection'

import apps from '@/apps'
import { parseFormIdFormat } from '@/apps/formsg/auth/verify-credentials'
import type { FormSchema } from '@/apps/formsg/common/types'
import { fetchFormSchema } from '@/apps/formsg/triggers/new-submission/fetch-form-schema'
import globalVariable from '@/helpers/global-variable'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'
import { loadAccessibleStep } from '@/services/access'
import { getConnection } from '@/services/connection'
import { lookupStepDefinition } from '@/services/step-definition'
import { prepareStepParameters } from '@/services/step-parameters'

import { registerConnectionService } from './register-connection'
import { appendStepAiBuilderEvent } from './step-ai-builder-config'
import { verifyConnectionRegistrationService } from './verify-connection-registration'

export interface UpdateStepParametersInput {
  user: User
  pipeId: string
  stepId: string
  parameters: Record<string, unknown>
  connectionId?: string
  traceId?: string
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
  traceId,
}: UpdateStepParametersInput): Promise<McpUpdateStepParametersResult> {
  const { step, rawApp } = await Step.transaction(async (trx) => {
    const accessible = await loadAccessibleStep({
      user,
      stepId,
      flowId: pipeId,
      role: 'editor',
      trx,
    })

    if (!accessible) {
      throw new Error('Step not found')
    }

    // Re-fetch with a row lock to serialise concurrent tool calls for the same
    // step. PostgreSQL rejects FOR UPDATE on loadAccessibleStep's LEFT JOIN.
    const step = await Step.query(trx).forUpdate().findById(stepId)
    if (!step) {
      throw new Error('Step cannot be updated')
    }

    const lookup = lookupStepDefinition(step.appKey, step.key)

    if (lookup.kind === 'unknown') {
      throw new Error('No such trigger or action')
    }

    if (lookup.kind === 'hidden') {
      throw new Error(
        `${
          step.type === 'trigger' ? 'Trigger' : 'Action'
        } can only be updated by system`,
      )
    }

    const { definition } = lookup
    const rawApp = apps[step.appKey]

    // Silently drop any keys not in this action/trigger's declared argument schema
    const allowedKeys = new Set((definition.arguments ?? []).map((f) => f.key))
    const filteredParameters = Object.fromEntries(
      Object.entries(parameters).filter(([k]) => allowedKeys.has(k)),
    ) as IJSONObject

    const { parameters: patchedParameters, version } = prepareStepParameters({
      appKey: step.appKey,
      key: step.key,
      parameters: filteredParameters,
      version: step.version,
    })

    // Merge so repeated tool calls (one param at a time) accumulate rather than overwrite.
    const mergedParameters = {
      ...(step.parameters ?? {}),
      ...patchedParameters,
    } as IJSONObject

    if (step.type === 'action') {
      const action = definition as IRawAction
      action.validateStepParameters?.(mergedParameters)
    }

    if (connectionId !== undefined) {
      // Scoped to this pipe, not "any connection the user can see": a
      // collaborator's broader accessible-connections set spans every flow
      // they touch, which would let them attach another flow's connection here.
      const connection = await getConnection({
        user,
        connectionId,
        flowId: pipeId,
        includeOwnConnections: true,
        trx,
      }).catch((error) => {
        if (error instanceof NotFoundError) {
          throw new Error('Connection not found')
        }
        throw error
      })

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
      ...(traceId && {
        config: appendStepAiBuilderEvent(
          step.config,
          { traceId, tool: 'update_step_parameters' },
          { skipIfRecorded: true },
        ),
      }),
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
