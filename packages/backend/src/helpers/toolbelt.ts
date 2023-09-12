import { IStep } from '@plumber/types'

import { KEY as TOOLBELT_APP_KEY } from '@/apps/toolbelt'
import { KEY as IF_THEN_ACTION_KEY } from '@/apps/toolbelt/actions/if-then'

export function isIfThenStep(step: IStep): boolean {
  return step.appKey === TOOLBELT_APP_KEY && step.key === IF_THEN_ACTION_KEY
}
