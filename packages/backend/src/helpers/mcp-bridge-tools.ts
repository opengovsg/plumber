import type { IApp, IMcpApp } from '@plumber/types'

import { tool } from 'ai'
import { z } from 'zod/v4'

import type User from '@/models/user'
import { listAppsService } from '@/services/mcp/apps'

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
  }
}
