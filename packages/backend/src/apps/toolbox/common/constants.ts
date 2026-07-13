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

// Parameter key holding the id of the last step inside a new-style if-then block
// (inclusive). Its presence (Object.hasOwn) — not its value — distinguishes a
// new-style if-then from a legacy one. Empty block => self-reference (own id).
export const IF_THEN_END_STEP_ID_PARAM = 'endStepId'

type IfThenStepLike = {
  appKey?: string | null
  key?: string | null
  parameters?: Record<string, unknown> | null
}

export function isIfThenStep(step: IfThenStepLike | null | undefined): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.IF_THEN
  )
}

export function isNewStyleIfThen(
  step: IfThenStepLike | null | undefined,
): boolean {
  return (
    isIfThenStep(step) &&
    Object.hasOwn(step?.parameters ?? {}, IF_THEN_END_STEP_ID_PARAM)
  )
}

export const FOR_EACH_TABLE_SOURCES = [
  FOR_EACH_INPUT_SOURCE.TILES,
  FOR_EACH_INPUT_SOURCE.M365_EXCEL,
  FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
] as const
