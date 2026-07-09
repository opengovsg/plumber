import type { IMcpApp } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod/v4'

import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'

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
  }
}
