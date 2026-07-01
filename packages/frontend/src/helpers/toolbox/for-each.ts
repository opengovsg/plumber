import { type IStep } from '@plumber/types'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from './common'

//
// Helpers for For-each
//
export function isForEachStep(step: IStep | null | undefined): step is IStep {
  return (
    !!step &&
    step.appKey === TOOLBOX_APP_KEY &&
    step.key === TOOLBOX_ACTIONS.ForEach
  )
}
