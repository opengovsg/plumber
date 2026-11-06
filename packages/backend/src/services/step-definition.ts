import type { IRawAction, IRawTrigger } from '@plumber/types'

import apps from '@/apps'

type Visibility = 'permitted' | 'hidden'

export type StepDefinitionLookup =
  | { kind: Visibility; type: 'trigger'; definition: IRawTrigger }
  | { kind: Visibility; type: 'action'; definition: IRawAction }
  | { kind: 'unknown' }

export function isUserVisible(definition: {
  hiddenFromUser?: boolean
}): boolean {
  return !definition.hiddenFromUser
}

function visibility(definition: { hiddenFromUser?: boolean }): Visibility {
  return isUserVisible(definition) ? 'permitted' : 'hidden'
}

/** Searches only the given type, so a trigger and an action may share a key. */
export function lookupStepDefinition(
  appKey: string,
  key: string,
  type: 'trigger' | 'action',
): StepDefinitionLookup {
  const app = apps[appKey]

  if (type === 'trigger') {
    const definition = app?.triggers?.find((trigger) => trigger.key === key)
    return definition
      ? { kind: visibility(definition), type, definition }
      : { kind: 'unknown' }
  }

  const definition = app?.actions?.find((action) => action.key === key)
  return definition
    ? { kind: visibility(definition), type, definition }
    : { kind: 'unknown' }
}
