import { z } from 'zod/v3'

import apps from '@/apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'

/**
 * Generates valid appKey enum from registered apps
 */
export function getAppKeys() {
  return Object.keys(apps) as [string, ...string[]]
}

/**
 * Gets all action keys for a specific app
 */
export function getActionKeys(appKey: string): string[] {
  const app = apps[appKey]
  return app?.actions?.map((action) => action.key) || []
}

/**
 * Gets all trigger keys for a specific app
 */
export function getTriggerKeys(appKey: string): string[] {
  const app = apps[appKey]
  return app?.triggers?.map((trigger) => trigger.key) || []
}

/**
 * Generic schema generator for actions or triggers
 */
export function generateSchema(
  baseSchema: z.ZodObject<any>,
  schemaType: 'action' | 'trigger',
) {
  const schemas = getAppKeys()
    .map((appKey) => {
      const keys =
        schemaType === 'action' ? getActionKeys(appKey) : getTriggerKeys(appKey)

      if (keys.length === 0) {
        return null
      }

      // IF-THEN special case: add depth and branchName parameters
      const isIfThenAction =
        schemaType === 'action' &&
        appKey === TOOLBOX_APP_KEY &&
        keys.includes(TOOLBOX_ACTIONS.IF_THEN)

      const extension = {
        appKey: z.literal(appKey),
        key: z.enum(keys as [string, ...string[]]),
        ...(isIfThenAction && {
          parameters: z.object({
            depth: z.literal(0).optional(),
            branchName: z.string().optional().default('Branch'),
          }),
        }),
      }

      return baseSchema.extend(extension)
    })
    .filter(Boolean)

  return z.discriminatedUnion('appKey', schemas as any)
}
