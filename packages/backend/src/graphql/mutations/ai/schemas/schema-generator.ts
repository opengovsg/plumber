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
    .flatMap((appKey) => {
      const keys =
        schemaType === 'action' ? getActionKeys(appKey) : getTriggerKeys(appKey)

      if (keys.length === 0) {
        return []
      }

      // Create a separate schema for each appKey/key combination
      return keys.map((key) => {
        // Only add parameters for specific appKey/key combinations
        const isIfThenAction =
          appKey === TOOLBOX_APP_KEY && key === TOOLBOX_ACTIONS.IF_THEN

        const extendedFields: any = {
          appKey: z.literal(appKey),
          key: z.literal(key),
        }

        if (isIfThenAction) {
          extendedFields.parameters = z.object({
            depth: z.literal(0),
            branchName: z.string().default('Branch'),
          })
        }

        return baseSchema.extend(extendedFields)
      })
    })
    .filter(Boolean)

  return z.union(schemas as any)
}
