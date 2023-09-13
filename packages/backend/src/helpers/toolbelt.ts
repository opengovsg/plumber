import { IStep } from '@plumber/types'

import toolbeltApp from '@/apps/toolbelt'
import ifThenAction from '@/apps/toolbelt/actions/if-then'

export function isIfThenStep(step: IStep): boolean {
  return step.appKey === toolbeltApp.key && step.key === ifThenAction.key
}
