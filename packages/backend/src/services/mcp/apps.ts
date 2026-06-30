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
  const source = (field as any).source as
    | {
        type: string
        name: string
        arguments?: Array<{ name: string; value: string }>
      }
    | undefined
  const subFields = (field as any).subFields as
    | NonNullable<IRawTrigger['arguments']>
    | undefined

  if (field.type === 'dropdown' && options?.length && !source) {
    base.options = options.map((o) => ({
      label: o.label,
      value: String(o.value),
    }))
  } else if (field.type === 'dropdown' && source?.arguments?.length) {
    base.isDynamic = true
    const keyArg = source.arguments.find((a) => a.name === 'key')
    if (keyArg) {
      base.dynamicDataKey = keyArg.value
    }
    const paramArgs = source.arguments.filter((a) =>
      a.name.startsWith('parameters.'),
    )
    if (paramArgs.length > 0) {
      base.dynamicDataParameters = Object.fromEntries(
        paramArgs.map((a) => [a.name.slice('parameters.'.length), a.value]),
      )
    }
  }

  if (subFields?.length) {
    base.subFields = subFields.map(serializeField)
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
