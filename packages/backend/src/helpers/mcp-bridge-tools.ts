import type {
  IMcpApp,
  IMcpExecution,
  IMcpPipeDetail,
  IMcpPipeSummary,
  IMcpStepDetail,
} from '@plumber/types'

import { tool } from 'ai'
import axios from 'axios'
import { z } from 'zod'

import appConfig from '@/config/app'

/**
 * Build Vercel AI SDK tool definitions that proxy to the bridge API.
 * Called once per chat request; the user token is captured in the closure.
 */
export function createMcpBridgeTools(userToken: string, bridgeBaseUrl: string) {
  const headers = {
    'x-mcp-service-token': appConfig.mcpServiceToken,
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

  return {
    list_apps: tool({
      description: 'List all available Plumber apps, triggers, and actions.',
      inputSchema: z.object({}),
      execute: async () => {
        return bridgeGet<IMcpApp[]>('/internal/mcp/apps')
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
        'Get full details of a pipe including all its steps and parameters.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgeGet<IMcpPipeDetail>(`/internal/mcp/pipes/${pipe_id}`)
      },
    }),

    create_pipe: tool({
      description:
        'Create a new Plumber pipe. Always creates inactive — confirm with the user before activating.',
      inputSchema: z.object({
        name: z.string().describe('Human-readable name for the pipe'),
      }),
      execute: async ({ name }) => {
        return bridgePost<IMcpPipeDetail>('/internal/mcp/pipes', { name })
      },
    }),

    update_step_parameter: tool({
      description: `Configure a step in a pipe. All fields except pipe_id and step_id are optional — only provided fields are updated.
- Use app_key to set which app this step uses (e.g. "slack", "formsg"). Use list_apps to discover available app keys.
- Use key to set which trigger or action within the app (e.g. "sendMessageToChannel"). The valid keys are listed under each app in list_apps.
- Use connection_id to assign saved credentials. Use list_pipes or get_pipe to find existing connection IDs on configured steps.
- Use parameters to set field values. Field keys and types are listed under each action/trigger in list_apps.`,
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        step_id: z.string().describe('The step ID to configure'),
        app_key: z
          .string()
          .optional()
          .describe(
            'App key for this step (e.g. "slack", "formsg"). See list_apps.',
          ),
        key: z
          .string()
          .optional()
          .describe(
            'Trigger or action key within the app (e.g. "sendMessageToChannel"). See list_apps.',
          ),
        connection_id: z
          .string()
          .optional()
          .describe(
            'ID of the saved connection/credentials to use for this step.',
          ),
        parameters: z
          .record(z.unknown())
          .optional()
          .describe(
            'Field values for the step. Keys must match the field keys listed for the action/trigger in list_apps.',
          ),
      }),
      execute: async ({
        pipe_id,
        step_id,
        app_key,
        key,
        connection_id,
        parameters,
      }) => {
        return bridgePatch<IMcpStepDetail>(
          `/internal/mcp/pipes/${pipe_id}/steps/${step_id}`,
          {
            appKey: app_key,
            key,
            connectionId: connection_id,
            parameters,
          },
        )
      },
    }),

    activate_pipe: tool({
      description:
        'Activate a pipe. ONLY call after the user has explicitly confirmed they want to go live. The backend rejects activation if steps are incomplete.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID to activate'),
      }),
      execute: async ({ pipe_id }) => {
        return bridgePatch<{ id: string; active: boolean }>(
          `/internal/mcp/pipes/${pipe_id}/activate`,
          {},
        )
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
      description: 'Get details of a specific execution.',
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
