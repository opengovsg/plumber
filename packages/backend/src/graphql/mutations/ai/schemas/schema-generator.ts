import { z } from 'zod'

import apps from '@/apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'

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
      // Hidden triggers/actions (e.g. FormSG's mrfSubmission) are
      // system-managed. Never let the AI Builder fabricate one directly via
      // create_pipe, same guard as create_step's hiddenFromUser check. Only a
      // proposal preview opts in, since it never creates a step.
      const isVisible = (item: { hiddenFromUser?: boolean }) =>
        includeHidden || !item.hiddenFromUser
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

        return baseSchema.extend(extendedFields)
      })
    })
    .filter(Boolean)

  return z.union(schemas as any)
}
