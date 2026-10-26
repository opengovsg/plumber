import { z } from 'zod'

import apps from '@/apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { isUserVisible } from '@/services/step-definition'

import { ifThenChildCountSchema, ifThenParametersSchema } from './actions.zod'

function getActiveApps(restrictedAppKeys: string[] = []) {
  return Object.fromEntries(
    Object.entries(apps).filter(
      ([appKey]) => !restrictedAppKeys.includes(appKey),
    ),
  ) as typeof apps
}

/**
 * Generic schema generator for actions or triggers
 */
export function generateSchema(
  baseSchema: z.ZodObject<any>,
  schemaType: 'action' | 'trigger',
  restrictedAppKeys: string[] = [],
  { includeHidden = false }: { includeHidden?: boolean } = {},
) {
  const activeApps = getActiveApps(restrictedAppKeys)

  const schemas = Object.entries(activeApps)
    .flatMap(([appKey, app]) => {
      const isVisible = includeHidden ? () => true : isUserVisible
      const keys =
        schemaType === 'action'
          ? app?.actions?.filter(isVisible).map((action) => action.key) || []
          : app?.triggers?.filter(isVisible).map((trigger) => trigger.key) || []

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
          extendedFields.parameters = ifThenParametersSchema.prefault({})
          extendedFields.ifThenChildCount = ifThenChildCountSchema
        }

        if (
          schemaType === 'action' &&
          appKey === 'formsg' &&
          key === 'mrfSubmission'
        ) {
          extendedFields.isApproval = z.boolean().optional()
        }

        return baseSchema.extend(extendedFields)
      })
    })
    .filter(Boolean)

  return z.union(schemas as any)
}
