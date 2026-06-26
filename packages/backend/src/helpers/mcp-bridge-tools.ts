import type { IApp, IMcpApp, IMcpCreatePipeResult } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod/v4'

import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'
import { createPipeService } from '@/services/mcp/create-pipe'

type ListAppsInput = Record<string, IApp[]>

export function createMcpBridgeTools(user: User) {
  return {
    list_apps: tool<ListAppsInput, IMcpApp[]>({
      description:
        'List all available Plumber apps, triggers, and actions with their field schemas.',
      inputSchema: z.object({}),
      execute: async (): Promise<IMcpApp[]> => {
        return listAppsService(user)
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
      execute: async ({ name, steps }): Promise<IMcpCreatePipeResult> => {
        return createPipeService(
          user,
          name,
          steps.map((s) => ({
            appKey: s.app_key,
            triggerKey: s.trigger_key,
            actionKey: s.action_key,
          })),
        )
      },
    }),
  }
}
