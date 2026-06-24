import type {
  IMcpApp,
  IMcpConnection,
  IMcpCreatePipeResult,
  IMcpExecution,
  IMcpFieldOption,
  IMcpPipeDetail,
  IMcpPipeSummary,
} from '@plumber/types'

import { tool } from 'ai'
import axios from 'axios'
import { z } from 'zod'

/**
 * Build Vercel AI SDK tool definitions that proxy to the bridge API.
 * Called once per chat request; the user token is captured in the closure.
 */
export function createMcpBridgeTools(userToken: string, bridgeBaseUrl: string) {
  const headers = {
    authorization: `Bearer ${userToken}`,
  }

  async function bridgeGet<T>(path: string): Promise<T> {
    const { data } = await axios.get<T>(`${bridgeBaseUrl}${path}`, { headers })
    return data
  }

  async function bridgePost<T>(path: string, body: unknown): Promise<T> {
    const { data } = await axios.post<T>(`${bridgeBaseUrl}${path}`, body, {
      headers,
    })
    return data
  }

  async function bridgePatch<T>(path: string, body: unknown): Promise<T> {
    const { data } = await axios.patch<T>(`${bridgeBaseUrl}${path}`, body, {
      headers,
    })
    return data
  }

  async function bridgeDelete(path: string): Promise<void> {
    await axios.delete(`${bridgeBaseUrl}${path}`, { headers })
  }

  return {
    list_connections: tool({
      description:
        'List all verified app connections the user has. Use the returned IDs when assigning connections to steps.',
      inputSchema: z.object({}),
      execute: async () => {
        return bridgeGet<IMcpConnection[]>('/internal/mcp/connections')
      },
    }),

    list_apps: tool({
      description:
        'List all available Plumber apps, triggers, and actions with their field schemas.',
      inputSchema: z.object({}),
      execute: async () => {
        return bridgeGet<IMcpApp[]>('/internal/mcp/apps')
      },
    }),

    get_field_options: tool({
      description:
        'Fetch live options for a dynamic dropdown field (e.g. Slack channels, FormSG forms). Call list_apps first to identify which fields have isDynamic: true.',
      inputSchema: z.object({
        app_key: z.string().describe('App key (e.g. "slack")'),
        action_key: z
          .string()
          .describe('Action or trigger key (e.g. "sendMessageToChannel")'),
        field_key: z.string().describe('Field key (e.g. "channelId")'),
        connection_id: z
          .string()
          .describe('Verified connection ID to use for the lookup'),
      }),
      execute: async ({ app_key, action_key, field_key, connection_id }) => {
        return bridgeGet<{ options: IMcpFieldOption[] }>(
          `/internal/mcp/apps/${app_key}/actions/${action_key}/fields/${field_key}/options?connectionId=${connection_id}`,
        )
      },
    }),

    list_pipes: tool({
      description: 'List all pipes the user has access to.',
      inputSchema: z.object({}),
      execute: async () => {
        return bridgeGet<IMcpPipeSummary[]>('/internal/mcp/pipes')
      },
    }),

    get_pipe: tool({
      description:
        'Get full details of a pipe including all steps and their configured parameters.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgeGet<IMcpPipeDetail>(`/internal/mcp/pipes/${pipe_id}`)
      },
    }),

    create_pipe: tool({
      description:
        'Create a new inactive pipe with an ordered list of steps. First step is the trigger, subsequent steps are actions. Always creates inactive — never activate without explicit user confirmation.',
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
            }),
          )
          .min(1)
          .describe(
            'Ordered list of steps. First element must have trigger_key.',
          ),
      }),
      execute: async ({ name, steps }) => {
        return bridgePost<IMcpCreatePipeResult>('/internal/mcp/pipes', {
          name,
          steps: steps.map((s) => ({
            appKey: s.app_key,
            triggerKey: s.trigger_key,
            actionKey: s.action_key,
          })),
        })
      },
    }),

    add_step: tool({
      description:
        'Add a new step to an existing inactive pipe at a given position. Subsequent steps shift down.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        app_key: z.string().describe('App key for the new step'),
        trigger_key: z
          .string()
          .optional()
          .describe('Trigger key (if adding a trigger step)'),
        action_key: z
          .string()
          .optional()
          .describe('Action key (if adding an action step)'),
        position: z
          .number()
          .int()
          .min(1)
          .describe('1-indexed position to insert the step at'),
      }),
      execute: async ({
        pipe_id,
        app_key,
        trigger_key,
        action_key,
        position,
      }) => {
        return bridgePost(`/internal/mcp/pipes/${pipe_id}/steps`, {
          appKey: app_key,
          triggerKey: trigger_key,
          actionKey: action_key,
          position,
        })
      },
    }),

    remove_step: tool({
      description:
        'Remove a step from an existing inactive pipe. Subsequent steps shift up.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        step_id: z.string().describe('The step ID to remove'),
      }),
      execute: async ({ pipe_id, step_id }) => {
        await bridgeDelete(`/internal/mcp/pipes/${pipe_id}/steps/${step_id}`)
        return { success: true }
      },
    }),

    configure_step: tool({
      description: `Set parameter values on a step, and optionally assign a connection.
Call this once per step (or multiple times incrementally). Pass all known parameter values in one call.
- parameters: field values keyed by field key (from list_apps field schemas)
- connection_id: optional, set when assigning a verified connection to this step
The response returns the full updated parameter map so you can confirm what is set.`,
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        step_id: z.string().describe('The step ID to configure'),
        parameters: z
          .record(z.unknown())
          .describe('Field values. Keys must match field keys from list_apps.'),
        connection_id: z
          .string()
          .optional()
          .describe(
            'Connection ID to assign to this step (from list_connections or create_connection).',
          ),
      }),
      execute: async ({ pipe_id, step_id, parameters, connection_id }) => {
        return bridgePatch<{
          step: { stepId: string; parameters: Record<string, unknown> }
        }>(`/internal/mcp/pipes/${pipe_id}/steps/${step_id}`, {
          parameters,
          connectionId: connection_id,
        })
      },
    }),

    execute_step: tool({
      description:
        'Execute a single step and return its output data. Same as "Test step" in the editor — side effects are expected. Call after configuring the trigger step to get real output variables for downstream steps.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        step_id: z.string().describe('The step ID to execute'),
      }),
      execute: async ({ pipe_id, step_id }) => {
        return bridgePost(
          `/internal/mcp/pipes/${pipe_id}/steps/${step_id}/execute`,
          {},
        )
      },
    }),

    activate_pipe: tool({
      description:
        'Activate a pipe. ONLY call after the user has explicitly confirmed they want to go live. Returns isError: true with incompleteSteps if any step is not fully configured.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID to activate'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgePatch(`/internal/mcp/pipes/${pipe_id}/activate`, {})
      },
    }),

    deactivate_pipe: tool({
      description: 'Deactivate a pipe so it stops processing new events.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID to deactivate'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgePatch<{ id: string; active: boolean }>(
          `/internal/mcp/pipes/${pipe_id}/deactivate`,
          {},
        )
      },
    }),

    create_connection: tool({
      description:
        'Create a new verified connection for an app. In v1, scoped to FormSG secret-key connections only. Returns connectionId to use in configure_step.',
      inputSchema: z.object({
        app_key: z
          .string()
          .describe('App key — currently only "formsg" is supported'),
        connection_type: z
          .string()
          .describe('Connection type — currently only "secret-key"'),
        credentials: z
          .record(z.string())
          .describe(
            'Credentials map. For FormSG: { secretKey: "<paste-key-here>" }',
          ),
      }),
      execute: async ({ app_key, connection_type, credentials }) => {
        return bridgePost<{ connectionId: string; label: string }>(
          '/internal/mcp/connections',
          {
            appKey: app_key,
            connectionType: connection_type,
            credentials,
          },
        )
      },
    }),

    list_executions: tool({
      description: 'List the most recent executions for a pipe.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgeGet<IMcpExecution[]>(
          `/internal/mcp/pipes/${pipe_id}/executions`,
        )
      },
    }),

    get_execution: tool({
      description:
        'Get details of a specific execution including per-step status and errors.',
      inputSchema: z.object({
        execution_id: z.string().describe('The execution ID'),
      }),
      execute: async ({ execution_id }) => {
        return bridgeGet<IMcpExecution>(
          `/internal/mcp/executions/${execution_id}`,
        )
      },
    }),
  }
}
