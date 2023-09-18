import { type IStep } from '@plumber/types'

export const TOOLBELT_APP_KEY = 'toolbelt'

export enum TOOLBELT_ACTIONS {
  IfThen = 'ifThen',
}

export function isIfThenStep(step: IStep): boolean {
  return (
    step.appKey === TOOLBELT_APP_KEY && step.key === TOOLBELT_ACTIONS.IfThen
  )
}
