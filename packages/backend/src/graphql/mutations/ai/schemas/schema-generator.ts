import { z } from 'zod/v3'

import apps from '@/apps'

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

      return baseSchema.extend({
        appKey: z.literal(appKey),
        key: z.enum(keys as [string, ...string[]]),
      })
    })
    .filter(Boolean)

  return z.discriminatedUnion('appKey', schemas as any)
}
