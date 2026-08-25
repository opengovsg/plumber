import type { IApp, IJSONObject, IMcpApp } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod/v4'

import type Flow from '@/models/flow'
import type Step from '@/models/step'
import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'
import {
  createFlowWithStepsService,
  type McpStepInput,
} from '@/services/mcp/create-flow-with-steps'
import { createStepService } from '@/services/mcp/create-step'
import { deleteStepService } from '@/services/mcp/delete-step'
import {
  executeStepService,
  type McpExecuteStepResult,
} from '@/services/mcp/execute-step'
import {
  getFormSchemaService,
  type McpFormSchemaResult,
} from '@/services/mcp/get-form-schema'
import {
  type ListColumnsResult,
  listColumnsService,
} from '@/services/mcp/list-columns'
import {
  listConnectionsService,
  type McpConnection,
} from '@/services/mcp/list-connections'
import {
  type RegisterConnectionResult,
  registerConnectionService,
} from '@/services/mcp/register-connection'
import {
  type McpUpdateStepParametersResult,
  updateStepParametersService,
} from '@/services/mcp/update-step-parameters'

type ListAppsInput = Record<string, IApp[]>

export function createMcpBridgeTools(
  user: User,
  traceId: string,
  onPipeChange?: (pipeId: string) => void,
  onStepUpdate?: (
    stepId: string,
    parameters: IJSONObject,
    parameterLabels?: Record<string, string>,
  ) => void,
) {
  return {
    list_apps: tool<ListAppsInput, IMcpApp[]>({
      description:
        "List all available Plumber apps, triggers, and actions with their field schemas. A field's variableTypes, when present, restricts it to upstream variables whose execute_step dataOutMetadata type matches one of the listed values.",
      inputSchema: z.object({}),
      execute: async (): Promise<IMcpApp[]> => {
        return listAppsService(user)
      },
    }),

    list_connections: tool<{ app_key?: string }, McpConnection[]>({
      description:
        "List connections the user has set up, optionally filtered to a specific app. Returns each connection's ID, app key, verified status, and label. Use the returned id as connection_id when calling update_step_parameters.",
      inputSchema: z.object({
        app_key: z
          .string()
          .optional()
          .describe(
            'App key to filter by (e.g. "slack"). Omit to list all connections.',
          ),
      }),
      execute: async ({ app_key }): Promise<McpConnection[]> => {
        return listConnectionsService(user, app_key)
      },
    }),

    list_columns: tool<{ step_id: string }, ListColumnsResult>({
      description:
        'List the columns of a step\'s multirow-multicol field (e.g. Tiles "Create row" rowData, M365 Excel "Create table row" columnValues) that are not yet configured. Returns at most 50 not-yet-configured columns; if truncated is true, tell the user this table has more columns than can be proposed at once and that they can add the rest manually in the pipe editor after the step is created. Use the returned column id and name exactly as given — never guess or recall column names from memory, and never call this for a field that isn\'t multirow-multicol.',
      inputSchema: z.object({
        step_id: z
          .uuid()
          .describe(
            "ID of the step whose multirow-multicol field's columns to list",
          ),
      }),
      execute: async ({ step_id }): Promise<ListColumnsResult> => {
        return listColumnsService({ user, stepId: step_id })
      },
    }),

    create_pipe: tool({
      description:
        'Create a new inactive pipe with an ordered list of steps. First step is the trigger, subsequent steps are actions. Always creates inactive — never activate without explicit user confirmation. For toolbox/ifThen and toolbox/onlyContinueIf steps, include parameters with conditions (and branchName for ifThen) in the step — see the parameters field for the conditions shape.',
      inputSchema: z.object({
        name: z.string().describe('Human-readable name for the pipe'),
        steps: z
          .array(
            z.object({
              app_key: z.string().describe('App key (e.g. "formsg", "slack")'),
              trigger_key: z
                .string()
                .optional()
                .describe('Trigger key for step 0 (e.g. "newSubmission")'),
              action_key: z
                .string()
                .optional()
                .describe(
                  'Action key for steps 1+ (e.g. "sendMessageToChannel")',
                ),
              parameters: z
                .record(z.string(), z.unknown())
                .optional()
                .describe(
                  'Initial parameter values for this step. For toolbox/ifThen and toolbox/onlyContinueIf steps, conditions is an array of OR-groups, each { rows: [...] }, where each row is { field, is: "is"|"not", condition, text }, e.g. conditions: [{ rows: [{ field: "{{1.status}}", is: "is", condition: "equals", text: "done" }] }]. ifThen additionally requires branchName.',
                ),
            }),
          )
          .min(1)
          .describe(
            'Ordered list of steps. First element must have trigger_key.',
          ),
      }),
      execute: async ({ name, steps }): Promise<Flow> => {
        const flow = await createFlowWithStepsService({
          user,
          name,
          steps: steps.map(
            (s, index): McpStepInput => ({
              appKey: s.app_key,
              key: s.trigger_key ?? s.action_key ?? null,
              type: index === 0 ? 'trigger' : 'action',
              position: index + 1,
              ...(s.parameters && { parameters: s.parameters }),
            }),
          ),
          traceId,
        })
        onPipeChange?.(flow.id)
        return flow
      },
    }),

    update_step_parameters: tool({
      description:
        "Save parameter values onto an existing step. Only field keys defined in the step's action/trigger schema are saved — unknown keys are silently dropped. Optionally assign a connection by passing connection_id (obtain from list_connections; must match the step's app). Call after create_pipe to fill in step configuration. appKey and key are immutable after creation; to change the action, delete the step and add a new one.\n\nWhen connection_id is provided for a step whose app uses per-step or global connection registration, registration runs automatically. Inspect the result before proceeding:\n- connectionRegistered: true — registration succeeded; step is fully connected.\n- connectionConflict: true + connectionConflictMessage — webhook already claimed; relay connectionConflictMessage to the user verbatim and call register_connection with the same step_id and connection_id only after explicit confirmation.\n- connectionError — permission or technical error; surface to user. Do not retry.\n- formFields (FormSG only, present on conflict or error) — trimmed field list for wiring downstream steps even when trigger is unconnected.",
      inputSchema: z.object({
        pipe_id: z.uuid().describe('ID of the pipe that contains the step'),
        step_id: z.uuid().describe('ID of the step to update'),
        parameters: z
          .record(z.string(), z.unknown())
          .describe(
            "Parameter key/value pairs to save. Only keys matching the step's field schema are kept.",
          ),
        connection_id: z
          .uuid()
          .optional()
          .describe(
            "Connection ID to assign to this step. Obtain from list_connections. The connection's app must match the step's app.",
          ),
        parameter_labels: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Human-readable display labels for parameter values that are IDs or opaque keys (e.g. dynamic dropdown selections). Map each parameter key to the label the user would recognise. Used for display only — does not affect what is saved.',
          ),
      }),
      execute: async ({
        pipe_id,
        step_id,
        parameters,
        connection_id,
        parameter_labels,
      }): Promise<McpUpdateStepParametersResult> => {
        const result = await updateStepParametersService({
          user,
          pipeId: pipe_id,
          stepId: step_id,
          parameters,
          connectionId: connection_id,
        })
        onPipeChange?.(pipe_id)
        onStepUpdate?.(step_id, result.step.parameters, parameter_labels)
        return result
      },
    }),

    create_step: tool({
      description:
        'Add a new action step to an existing pipe. Validates that the app key and action key exist. Inserts after previousStepId. Returns the created step.',
      inputSchema: z.object({
        pipe_id: z.uuid().describe('ID of the pipe to add the step to'),
        app_key: z.string().describe('App key (e.g. "slack")'),
        action_key: z
          .string()
          .describe('Action key (e.g. "sendMessageToChannel")'),
        previous_step_id: z
          .uuid()
          .describe(
            "ID of the step after which to insert. Pass the last step's id to append at the end.",
          ),
      }),
      execute: async ({
        pipe_id,
        app_key,
        action_key,
        previous_step_id,
      }): Promise<Step> => {
        const step = await createStepService({
          user,
          pipeId: pipe_id,
          appKey: app_key,
          key: action_key,
          previousStepId: previous_step_id,
        })
        onPipeChange?.(pipe_id)
        return step
      },
    }),

    delete_step: tool({
      description:
        'Delete a single step from a pipe. Deleting a trigger replaces it with an empty trigger slot; deleting an action removes it and repositions the remaining steps. Steps that reference the deleted step are marked incomplete. Returns the updated pipe with all remaining steps.',
      inputSchema: z.object({
        pipe_id: z.uuid().describe('ID of the pipe that contains the step'),
        step_id: z.uuid().describe('ID of the step to delete'),
      }),
      execute: async ({ pipe_id, step_id }): Promise<Flow> => {
        const flow = await deleteStepService({
          user,
          pipeId: pipe_id,
          stepId: step_id,
        })
        onPipeChange?.(pipe_id)
        return flow
      },
    }),

    execute_step: tool({
      description:
        "Test a configured step in a pipe. Runs the step, marks it as completed on success, and returns its output data. Call after update_step_parameters to verify the step works. The returned dataOut will be used to wire variables into downstream steps; dataOutMetadata tags each dataOut key with a type (e.g. 'array', 'table') — cross-check this against a downstream field's variableTypes (from list_apps) before templating a {{step.X.path}} reference into that field. Warning: for steps that send a real message (SMS by Postman sendSms, Telegram sendMessage, Slack sendMessageToChannel, PaySG sendEmail), this actually sends it to the configured recipient/channel/number — confirm the details with the user before calling this for those steps.",
      inputSchema: z.object({
        step_id: z.uuid().describe('ID of the step to test'),
      }),
      execute: async ({ step_id }): Promise<McpExecuteStepResult> => {
        let pipeId: string | undefined
        try {
          const result = await executeStepService(user, step_id)
          pipeId = result.pipeId
          return result
        } finally {
          if (pipeId) {
            onPipeChange?.(pipeId)
          }
        }
      },
    }),

    get_form_schema: tool({
      description:
        'Fetch the PUBLIC schema of a FormSG form from its URL or bare 24-character form ID. ' +
        'Requires no connection and no secret key, so it can be used before a pipe or connection exists. ' +
        'Returns the form title, storage-mode/MRF flags, warnings, and per-field ' +
        '{ id, title, fieldType, required, answerType, variablePath } for templating variables as ' +
        '{{step.<triggerStepId>.<variablePath>}}. Errors are returned as { error } — relay them to the user.',
      inputSchema: z.object({
        form_url: z
          .string()
          .describe(
            'FormSG form URL (e.g. https://form.gov.sg/<id>) or bare 24-character form ID.',
          ),
      }),
      execute: async ({ form_url }): Promise<McpFormSchemaResult> => {
        return getFormSchemaService(form_url)
      },
    }),

    register_connection: tool({
      description:
        'Register a FormSG connection on a trigger step, overwriting any existing webhook. ' +
        'Call ONLY after the user has explicitly confirmed they want to overwrite the existing webhook. ' +
        'On success the connection is persisted to the step.',
      inputSchema: z.object({
        pipe_id: z.uuid().describe('ID of the pipe containing the step'),
        step_id: z.uuid().describe('ID of the trigger step to register'),
        connection_id: z
          .uuid()
          .describe(
            'Connection ID to register and persist on the step. Pass the same connection_id from the preceding update_step_parameters call.',
          ),
      }),
      execute: async ({
        pipe_id,
        step_id,
        connection_id,
      }): Promise<RegisterConnectionResult> => {
        const result = await registerConnectionService(
          user,
          step_id,
          connection_id,
        )
        onPipeChange?.(pipe_id)
        return result
      },
    }),
  }
}
