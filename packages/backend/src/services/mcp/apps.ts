import type {
  IMcpApp,
  IMcpAppField,
  IRawAction,
  IRawTrigger,
  IUser,
} from '@plumber/types'

import apps from '@/apps'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'

const TOOLBOX_APP_KEY = 'toolbox'

function serializeField(
  field: NonNullable<IRawTrigger['arguments']>[number],
): IMcpAppField {
  const base: IMcpAppField = {
    key: field.key,
    label: field.label,
    type: field.type,
    description: (field as any).description,
    required: (field as any).required ?? false,
  }
  const options = (field as any).options as
    | Array<{ label: string; value: unknown }>
    | undefined
  if (field.type === 'dropdown' && options?.length && !(field as any).source) {
    base.options = options.map((o) => ({
      label: o.label,
      value: String(o.value),
    }))
  }
  return base
}

export async function listAppsService(user: IUser): Promise<IMcpApp[]> {
  const allLdFlags = await getAllLdFlags(user.email)
  const restrictedApps = getRestrictedAppKeys(allLdFlags)

  return Object.values(apps)
    .filter((app) => {
      if (restrictedApps.includes(app.key)) {
        return false
      }
      // Toolbox is hidden by default; only show if explicitly enabled
      if (app.key === TOOLBOX_APP_KEY) {
        return allLdFlags[`app_${app.key}`] === true
      }
      return true
    })
    .map((app) => ({
      key: app.key,
      name: app.name,
      requiresConnection: !!app.auth,
      triggers: (app.triggers ?? [])
        .filter((t) => allLdFlags[`app_${app.key}_trigger_${t.key}`] !== false)
        .map((t) => {
          const raw = t as unknown as IRawTrigger
          return {
            key: t.key,
            name: t.name,
            description: t.description,
            fields: (raw.arguments ?? []).map(serializeField),
          }
        }),
      actions: (app.actions ?? [])
        .filter((a) => allLdFlags[`app_${app.key}_action_${a.key}`] !== false)
        .map((a) => {
          const raw = a as unknown as IRawAction
          return {
            key: a.key,
            name: a.name,
            description: a.description,
            fields: (raw.arguments ?? []).map(serializeField),
          }
        }),
    }))
}
