import { IJSONObject } from '@plumber/types'

import { Step } from '@/graphql/__generated__/types.generated'

// Lookbehind so that overlapping "step.<id>." occurrences are still matched.
const stepIdInVariableRegExp = /(?<=step\.)[^.]+(?=\.)/g

export function updateStepIdForKey(
  value: string,
  oldToNewStepIdsMap: Record<string, string>,
) {
  /**
   * Example: this step position 3 has a key: "subject" and
   * a value of "{{step.123.fields.111.answer}} blah {{step.456.fields.222.answer}}"
   * 123 and 456 belongs to the previous 2 steps, so the mapping will be the old steps to new steps
   * */
  // Replaces data-id in postman also and all step variables with the curly braces notation.
  // IMPORTANT: one pass with a map lookup. Looping over the map per string
  // makes duplicateFlow cost steps² × keys.
  return value.replace(stepIdInVariableRegExp, (stepId) =>
    Object.hasOwn(oldToNewStepIdsMap, stepId)
      ? oldToNewStepIdsMap[stepId]
      : stepId,
  )
}

export function updateStepVariables(
  parameters: Step['parameters'],
  oldToNewStepIdsMap: Record<string, string>,
): IJSONObject {
  // IMPORTANT: do not spread an accumulator here. Copying it per key is
  // quadratic in key count and blocks the event loop on large parameters.
  return Object.fromEntries(
    Object.entries(parameters ?? {}).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, updateStepIdForKey(value, oldToNewStepIdsMap)]
      }

      if (Array.isArray(value)) {
        return [
          key,
          value.flatMap((item) => {
            // HACKFIX (kevinkim-ogp): remove uploaded attachments from the duplicated flow
            if (typeof item === 'string' && item.startsWith('s3:')) {
              return []
            }
            // could be a string or an object: attachments array would contain strings but conditions would contain objects
            if (typeof item === 'string') {
              return [updateStepIdForKey(item, oldToNewStepIdsMap)]
            }
            return updateStepVariables(item as IJSONObject, oldToNewStepIdsMap)
          }),
        ]
      }

      if (typeof value === 'object' && value !== null) {
        return [
          key,
          updateStepVariables(value as IJSONObject, oldToNewStepIdsMap),
        ]
      }

      return [key, value]
    }),
  )
}
