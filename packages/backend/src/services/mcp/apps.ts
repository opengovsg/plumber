import type {
  IMcpApp,
  IMcpAppField,
  IRawAction,
  IRawTrigger,
  IUser,
} from '@plumber/types'

import apps from '@/apps'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'

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
  // NOTE: filter out disabled apps based on LD flags.
  const allLdFlags = await getAllLdFlags(user.email)
  const restrictedApps = getRestrictedAppKeys(allLdFlags)
  const filteredApps = Object.fromEntries(
    Object.entries(apps).filter(([key]) => !restrictedApps.includes(key)),
  )

  return Object.values(filteredApps).map((app) => ({
    key: app.key,
    name: app.name,
    triggers: (app.triggers ?? []).map((t) => {
      const raw = t as unknown as IRawTrigger
      return {
        key: t.key,
        name: t.name,
        description: t.description,
        fields: (raw.arguments ?? []).map(serializeField),
      }
    }),
    actions: (app.actions ?? []).map((a) => {
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
