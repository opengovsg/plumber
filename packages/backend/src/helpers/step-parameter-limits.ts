import { BadUserInputError } from '@/errors/graphql-errors'

// Prod max on 2026-11-25 was 897 properties, depth 5 and 582 KB.
export const MAX_STEP_PARAMETER_PROPERTIES = 5_000
export const MAX_STEP_PARAMETER_DEPTH = 10
export const MAX_STEP_PARAMETER_BYTES = 1024 * 1024

export const STEP_PARAMETERS_TOO_LARGE_MESSAGE =
  'Step configuration is too large. Remove some fields and try again.'

/**
 * Bounds stored parameters so per-key work on them stays cheap.
 *
 * IMPORTANT: iterative and fail-fast, so deep input cannot overflow the stack
 * and wide input stops after MAX_STEP_PARAMETER_PROPERTIES value reads.
 */
export function assertStepParametersWithinLimits(parameters: unknown): void {
  if (parameters === null || parameters === undefined) {
    return
  }

  let properties = 0
  const stack: [value: unknown, depth: number][] = [[parameters, 0]]
  const visit = (child: unknown, depth: number) => {
    properties += 1
    if (
      properties > MAX_STEP_PARAMETER_PROPERTIES ||
      depth > MAX_STEP_PARAMETER_DEPTH
    ) {
      throw new BadUserInputError(STEP_PARAMETERS_TOO_LARGE_MESSAGE)
    }
    stack.push([child, depth])
  }

  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const [value, depth] = entry
    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child, depth + 1)
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (Object.hasOwn(value, key)) {
          visit((value as Record<string, unknown>)[key], depth + 1)
        }
      }
    }
  }

  if (
    Buffer.byteLength(JSON.stringify(parameters)) > MAX_STEP_PARAMETER_BYTES
  ) {
    throw new BadUserInputError(STEP_PARAMETERS_TOO_LARGE_MESSAGE)
  }
}
