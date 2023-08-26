import { type IStep } from '@plumber/types'

export const APP_KEY = 'plumber-toolbelt'

export enum ACTIONS {
  IfThen = 'ifThen',
}

export function isIfThenStep(step: IStep): boolean {
  return step.appKey === APP_KEY && step.key === ACTIONS.IfThen
}
