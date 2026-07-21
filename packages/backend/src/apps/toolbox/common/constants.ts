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

// Config key holding the id of the last step (inclusive) inside a block-like
// action's range. Generic across block actions — if-then today, for-each-ready.
// It lives in `config`, NOT `parameters`: a system-owned structural marker like
// `config.approval`, outside the parameters pipeline and invisible to the step
// form. Its presence (Object.hasOwn) — not its value — distinguishes a new-style
// block from a legacy one. Empty block => self-reference (own id).
export const BLOCK_END_STEP_ID = 'endStepId'

// The minimal step shape these predicates read, derived from IStep so it stays
// in sync. Not IStep itself: the execution context's $.step is trimmed (no
// config) and unit-test fixtures are partials — neither is a full IStep. Also
// reused as a base for the slightly wider shapes elsewhere in the toolbox.
export type StepLike = Partial<Pick<IStep, 'appKey' | 'key' | 'config'>>

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

export function isForEachStep(step: StepLike | null | undefined): boolean {
  return (
    step?.appKey === TOOLBOX_APP_KEY && step?.key === TOOLBOX_ACTIONS.FOR_EACH
  )
}

// A block-like step groups a range of later steps under itself (if-then or
// for-each). Everything else is a plain step that can be a block member.
export function isBlockStep(step: StepLike | null | undefined): boolean {
  return isIfThenStep(step) || isForEachStep(step)
}

// A step created with neither an app nor an event. The only legitimate way
// this happens is the if-then V1 branch initializer, which stubs a blank
// child so users see where to add their first action — createStep otherwise
// requires both fields together, so a step is never mid-configuration with
// just one of them unset.
export function isBlankPlaceholderStep(
  step: StepLike | null | undefined,
): boolean {
  return !step?.appKey && !step?.key
}

// A new-style ("v2") if-then carries the block endStep marker in config;
// presence (Object.hasOwn) — not value — distinguishes it from a legacy one.
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
