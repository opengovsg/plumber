import { IJSONObject } from '@plumber/types'

import { Step } from '@/graphql/__generated__/types.generated'

export function updateStepIdForKey(
  value: string,
  oldToNewStepIdsMap: Record<string, string>,
) {
  /**
   * Example: this step position 3 has a key: "subject" and
   * a value of "{{step.123.fields.111.answer}} blah {{step.456.fields.222.answer}}"
   * 123 and 456 belongs to the previous 2 steps, so the mapping will be the old steps to new steps
   * */
  let newValue = value
  for (const stepIdMapping of Object.entries(oldToNewStepIdsMap)) {
    const [oldStepId, newStepId] = stepIdMapping
    // Replaces data-id in postman also and all step variables with the curly braces notation
    const partialOldVariable = `step.${oldStepId}.`
    const partialNewVariable = `step.${newStepId}.`

    newValue = newValue.replaceAll(partialOldVariable, partialNewVariable)
  }
  return newValue
}

export function updateStepVariables(
  parameters: Step['parameters'],
  oldToNewStepIdsMap: Record<string, string>,
): Step['parameters'] {
  const entries = Object.entries(parameters)
  return entries.reduce((result, [key, value]) => {
    if (typeof value === 'string') {
      return {
        ...result,
        [key]: updateStepIdForKey(value, oldToNewStepIdsMap),
      }
    }

    if (Array.isArray(value)) {
      return {
        ...result,
        [key]: value.flatMap((item) => {
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
      }
    }

    if (typeof value === 'object' && value !== null) {
      return {
        ...result,
        [key]: updateStepVariables(value as IJSONObject, oldToNewStepIdsMap),
      }
    }

    return {
      ...result,
      [key]: value,
    }
  }, {})
}
