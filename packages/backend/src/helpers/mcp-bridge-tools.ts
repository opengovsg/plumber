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
      description:
        'Set or update configuration parameters for a specific step in a pipe.',
      inputSchema: z.object({
        pipe_id: z.string().describe('The pipe ID'),
        step_id: z.string().describe('The step ID to configure'),
        parameters: z
          .record(z.unknown())
          .describe('Key-value parameters to set on this step'),
      }),
      execute: async ({ pipe_id, step_id, parameters }) => {
        return bridgePatch<IMcpStepDetail>(
          `/internal/mcp/pipes/${pipe_id}/steps/${step_id}`,
          { parameters },
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
