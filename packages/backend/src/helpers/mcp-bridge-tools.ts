import type { IMcpApp } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod/v4'

import type Flow from '@/models/flow'
import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'
import {
  createFlowWithStepsService,
  type McpStepInput,
} from '@/services/mcp/create-flow-with-steps'

export function createMcpBridgeTools(user: User) {
  return {
    list_apps: tool<Record<string, never>, IMcpApp[]>({
      description:
        'List all available Plumber apps, triggers, and actions with their field schemas.',
      inputSchema: z.object({}),
      execute: async (): Promise<IMcpApp[]> => {
        return listAppsService(user)
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
        traceId: z.string().describe('Langfuse trace ID for this tool call'),
      }),
      execute: async ({ name, steps, traceId }): Promise<Flow> => {
        return createFlowWithStepsService({
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
      },
    }),
  }
}
