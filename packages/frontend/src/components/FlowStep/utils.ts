import { IJSONObject } from '@plumber/types'

import { GLOBAL_VARIABLE_REGEX } from '../RichTextEditor/utils'

export function hasMissingStepReference(
  obj: IJSONObject,
  stepMap: Set<string>,
) {
  const missing = new Set()

  function traverse(value: any) {
    if (!value) {
      return
    }

    if (typeof value === 'string') {
      const regex = new RegExp(GLOBAL_VARIABLE_REGEX)
      let match

      while ((match = regex.exec(value)) !== null) {
        try {
          const stepId = match[1].split('.')[1]
          if (!stepMap.has(stepId)) {
            missing.add(stepId)
          }
        } catch (error) {
          continue
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }

  traverse(obj)
  return missing.size > 0
}
