import type { IStep, TDataOutMetadatumType } from '@plumber/types'

import { ComboboxItem } from '@opengovsg/design-system-react'
import { extractVariables } from 'helpers/variables'

function extractVariablesAsItems(
  steps: IStep[],
  allowedTypes: TDataOutMetadatumType[] | null,
): ComboboxItem[] {
  const stepsWithVariables = extractVariables(steps)

  const result: ComboboxItem[] = []
  for (const step of stepsWithVariables) {
    for (const variable of step.output) {
      // Remove variables with types we don't want; untyped variables are
      // considered text.
      //
      // V8 should hoist this out of the loop automatically, so leaving check
      // inside the loop for more concise code.
      if (allowedTypes && !allowedTypes.includes(variable.type ?? 'text')) {
        continue
      }

      result.push({
        label: `[${step.name}] ${variable.label ?? variable.name}`,
        description: variable.displayedValue ?? String(variable.value),
        value: `{{${variable.name}}}`,
      })
    }
  }
  return result
}

export default extractVariablesAsItems
