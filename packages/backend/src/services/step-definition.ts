import type { IRawAction, IRawTrigger } from '@plumber/types'

import apps from '@/apps'

type StepDefinition = IRawTrigger | IRawAction

export type StepDefinitionLookup =
  | { kind: 'permitted'; definition: StepDefinition }
  | { kind: 'hidden'; definition: StepDefinition }
  | { kind: 'unknown' }

export function isUserVisible(definition: {
  hiddenFromUser?: boolean
}): boolean {
  return !definition.hiddenFromUser
}

export function lookupStepDefinition(
  appKey: string,
  key: string,
): StepDefinitionLookup {
  const app = apps[appKey]
  const definition = (app?.triggers?.find((trigger) => trigger.key === key) ??
    app?.actions?.find((action) => action.key === key)) as
    | StepDefinition
    | undefined

  if (!definition) {
    return { kind: 'unknown' }
  }

  return {
    kind: isUserVisible(definition) ? 'permitted' : 'hidden',
    definition,
  }
}
