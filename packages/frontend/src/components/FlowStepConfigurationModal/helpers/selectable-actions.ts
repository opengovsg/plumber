import type { IAction, IApp } from '@plumber/types'

import { getAppActionFlag } from '@/config/flags'

type FlagReader = (flagKey: string, defaultValue?: boolean) => unknown

/**
 * Actions this user can add.
 * A false action flag is omitted, so one remaining action is created immediately.
 */
export function getSelectableActions(
  app: Pick<IApp, 'key' | 'actions'>,
  getFlagValue: FlagReader,
): IAction[] {
  return (app.actions ?? []).filter((action) => {
    if (action.hiddenFromUser) {
      return false
    }
    if (!app.key) {
      return true
    }
    return Boolean(getFlagValue(getAppActionFlag(app.key, action.key), true))
  })
}
