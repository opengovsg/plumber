import type { IStep } from '@plumber/types'

export const FOR_EACH_ITERATION_KEY = '__ITERATION__'
export enum FOR_EACH_INPUT_SOURCE {
  M365_EXCEL = 'm365-excel',
  TILES = 'tiles',
  STRING_ARRAY = 'string-array',
  FORMSG_TABLE = 'formsg-table',
}

export const FOR_EACH_ITERATION_DELAY = 2000 // in ms
export const FOR_EACH_MAX_ITERATIONS = 500
export const TOOLBOX_APP_KEY = 'toolbox'
export enum TOOLBOX_ACTIONS {
  FOR_EACH = 'forEach',
  IF_THEN = 'ifThen',
  ONLY_CONTINUE_IF = 'onlyContinueIf',
}

// System-owned structural marker (like `config.approval`): lives in `config`,
// not `parameters`, outside the parameters pipeline and invisible to the step
// form.
export const BLOCK_END_STEP_ID = 'endStepId'

// Not IStep itself: the execution context's $.step is trimmed (no config), and
// unit-test fixtures pass partials — neither is a full IStep.
type StepLike = Partial<Pick<IStep, 'appKey' | 'key' | 'config'>>

export function isIfThenStep(step: StepLike | null | undefined): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.IF_THEN
  )
}

export function isOnlyContinueIfStep(
  step: StepLike | null | undefined,
): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY &&
    step?.key === TOOLBOX_ACTIONS.ONLY_CONTINUE_IF
  )
}

// IMPORTANT: presence (Object.hasOwn), not value, distinguishes an if-then V2
// step from if-then V1.
export function isIfThenV2(step: StepLike | null | undefined): boolean {
  return (
    isIfThenStep(step) && Object.hasOwn(step?.config ?? {}, BLOCK_END_STEP_ID)
  )
}

export const FOR_EACH_TABLE_SOURCES = [
  FOR_EACH_INPUT_SOURCE.TILES,
  FOR_EACH_INPUT_SOURCE.M365_EXCEL,
  FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
] as const
