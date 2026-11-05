import type { IAction, IApp } from '@plumber/types'

import {
  getAppActionFlag,
  getAppActionFlagFallback,
} from '@/config/flags'

type FlagReader = (flagKey: string, defaultValue?: boolean) => unknown

/**
 * Actions this user can add.
 * Find a message stays hidden until its flag is true, so Slack keeps one
 * action and the picker creates Send a message.
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
    return Boolean(
      getFlagValue(
        getAppActionFlag(app.key, action.key),
        getAppActionFlagFallback(app.key, action.key),
      ),
    )
  })
}
