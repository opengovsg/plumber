import type { IMcpApp } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod'

import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'

export function createMcpBridgeTools(_user: User) {
  return {
    list_apps: tool({
      description:
        'List all available Plumber apps, triggers, and actions with their field schemas.',
      inputSchema: z.object({}),
      execute: async (): Promise<IMcpApp[]> => {
        return listAppsService()
      },
    }),
  }
}
