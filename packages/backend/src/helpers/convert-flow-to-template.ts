import type { IFlow, IStep, ITemplate } from '@plumber/types'

import { STEP_ID_PLACEHOLDER } from '@/db/storage/constants'
import { updateStepVariables } from '@/helpers/update-duplicated-steps'

type ConvertibleFlow = Pick<IFlow, 'name'> & {
  steps: Pick<IStep, 'id' | 'position' | 'appKey' | 'key' | 'parameters'>[]
}

/**
 * Inverse of `createFlowFromTemplate`.
 *
 * Step ids become `<<step_id_N>>` placeholders because the new flow's steps get fresh ids.
 */
export function convertFlowToTemplate(
  flow: ConvertibleFlow,
  { id, description }: Pick<ITemplate, 'id' | 'description'>,
): ITemplate {
  const steps = [...flow.steps].sort((a, b) => a.position - b.position)

  // validate that all steps have event key and app key
  const hasRequiredAttributes = steps.every(({ key, appKey }) => key && appKey)
  if (!hasRequiredAttributes)
    throw new Error('Please ensure that all apps have an event trigger!')

  const stepIdToPlaceholderMap = Object.fromEntries(
    steps.map((step) => [step.id, STEP_ID_PLACEHOLDER(step.position)]),
  )

  return {
    id,
    name: flow.name,
    description,
    steps: steps.map((step) => ({
      position: step.position,
      appKey: step.appKey ?? undefined,
      eventKey: step.key ?? '',
      // cast here cos can return `null`
      parameters:
        updateStepVariables(step.parameters ?? {}, stepIdToPlaceholderMap) ??
        undefined,
    })),
  }
}
