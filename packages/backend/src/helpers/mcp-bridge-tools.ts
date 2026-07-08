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
import { getDynamicDataService } from '@/services/mcp/get-dynamic-data'
import {
  listConnectionsService,
  type McpConnection,
} from '@/services/mcp/list-connections'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'

type ListAppsInput = Record<string, IApp[]>

export function createMcpBridgeTools(
  user: User,
  traceId: string,
  onPipeChange?: (pipeId: string) => void,
) {
  return {
    list_apps: tool<ListAppsInput, IMcpApp[]>({
      description:
        'List all available Plumber apps, triggers, and actions with their field schemas.',
      inputSchema: z.object({}),
      execute: async (): Promise<IMcpApp[]> => {
        return listAppsService(user)
      },
    }),

    list_connections: tool<{ app_key?: string }, McpConnection[]>({
      description:
        "List connections the user has set up, optionally filtered to a specific app. Returns each connection's ID, app key, verified status, label, and formattedData. Use the returned id as connection_id when calling update_step_parameters.",
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

    create_pipe: tool({
      description:
        'Create a new inactive pipe with an ordered list of steps. First step is the trigger, subsequent steps are actions. Always creates inactive — never activate without explicit user confirmation. For toolbox/ifThen steps, include parameters with branchName and conditions in the step.',
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
                  'Initial parameter values for this step. For toolbox/ifThen steps pass branchName and conditions here.',
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
        "Save parameter values onto an existing step. Only field keys defined in the step's action/trigger schema are saved — unknown keys are silently dropped. Optionally assign a connection by passing connection_id (obtain from list_connections; must match the step's app). Call after create_pipe to fill in step configuration. appKey and key are immutable after creation; to change the action, delete the step and add a new one.",
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
      }),
      execute: async ({
        pipe_id,
        step_id,
        parameters,
        connection_id,
      }): Promise<Step> => {
        const step = await updateStepParametersService({
          user,
          pipeId: pipe_id,
          stepId: step_id,
          parameters,
          connectionId: connection_id,
        })
        onPipeChange?.(pipe_id)
        return step
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

    get_dynamic_data: tool({
      description:
        'Fetch live options for a dynamic dropdown field on a configured step (e.g. list channels, list tables, list files). Requires the step to have a connection set up. For cascading selections (e.g. list columns for a chosen table), pass the dependency value in parameters.',
      inputSchema: z.object({
        step_id: z
          .string()
          .describe('ID of the step whose dynamic data to fetch'),
        key: z
          .string()
          .describe(
            'Dynamic data key declared by the app (e.g. "listChannels", "listTables"). Check isDynamic fields from list_apps to find valid keys.',
          ),
        parameters: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Optional parameter overrides for cascading selections (e.g. { "tableId": "..." } to list columns for a specific table).',
          ),
      }),
      execute: async ({
        step_id,
        key,
        parameters,
      }): Promise<Array<{ name: string; value: string }>> => {
        return getDynamicDataService({
          user,
          stepId: step_id,
          key,
          parameters: parameters as IJSONObject | undefined,
        })
      },
    }),

    execute_step: tool({
      description:
        'Test a configured step in a pipe. Runs the step, marks it as completed on success, and returns its output data. Call after update_step_parameters to verify the step works. The returned dataOut will be used to wire variables into downstream steps.',
      inputSchema: z.object({
        step_id: z.string().describe('ID of the step to test'),
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
  }
}
