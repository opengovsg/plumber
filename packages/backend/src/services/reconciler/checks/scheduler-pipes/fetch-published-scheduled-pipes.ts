import type { IJSONObject } from '@plumber/types'

import schedulerApp from '@/apps/scheduler'
import BaseStep from '@/models/step/base'

export interface PublishedScheduledPipe {
  flowId: string
  publishedAt: string | null
  triggerKey: string
  triggerParameters: IJSONObject
}

export type ScheduledTriggerStep = Pick<
  BaseStep,
  'flowId' | 'parameters' | 'version'
> & { key: string; flow: Pick<BaseStep['flow'], 'publishedAt'> }

// BaseStep, not Step: Step imports every app, and some apps open Redis clients at import.
export function buildPublishedScheduledPipesQuery() {
  return BaseStep.query()
    .withGraphJoined('flow')
    .where('flow.active', true)
    .where('steps.type', 'trigger')
    .where('steps.app_key', schedulerApp.key)
    .whereIn(
      'steps.key',
      (schedulerApp.triggers ?? []).map((trigger) => trigger.key),
    )
}

// Step's $afterFind applies the transform, and BaseStep skips it.
export function toPublishedScheduledPipe(
  step: ScheduledTriggerStep,
  stepTransformer = schedulerApp.stepTransformer,
): PublishedScheduledPipe {
  return {
    flowId: step.flowId,
    publishedAt: step.flow.publishedAt ?? null,
    triggerKey: step.key,
    triggerParameters: stepTransformer
      ? stepTransformer.transformStepParameters(
          step.key,
          step.parameters,
          step.version,
        )
      : step.parameters,
  }
}

export async function fetchPublishedScheduledPipes(): Promise<
  PublishedScheduledPipe[]
> {
  const steps = await buildPublishedScheduledPipesQuery()
  // The query's `steps.key IN (...)` never matches a NULL key.
  return steps
    .filter((step): step is BaseStep & { key: string } => !!step.key)
    .map((step) => toPublishedScheduledPipe(step))
}
