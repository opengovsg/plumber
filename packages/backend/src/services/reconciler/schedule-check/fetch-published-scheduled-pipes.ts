import type { IJSONObject } from '@plumber/types'

import schedulerApp from '@/apps/scheduler'
import Step from '@/models/step'

export interface PublishedScheduledPipe {
  flowId: string
  publishedAt: string
  triggerKey: string
  triggerParameters: IJSONObject
}

type StepWithPublishedAt = Step & { publishedAt: string }

export function buildPublishedScheduledPipesQuery() {
  return (
    Step.query()
      .select(
        'steps.flow_id',
        'steps.app_key',
        'steps.key',
        'steps.parameters',
        'flow.published_at',
      )
      .joinRelated('flow')
      // The query builder only soft-delete filters the root table, not joins.
      .whereNull('flow.deleted_at')
      .where('flow.active', true)
      .where('steps.type', 'trigger')
      .where('steps.app_key', schedulerApp.key)
      .whereIn(
        'steps.key',
        schedulerApp.triggers.map((trigger) => trigger.key),
      )
  )
}

export async function fetchPublishedScheduledPipes(): Promise<
  PublishedScheduledPipe[]
> {
  const steps =
    (await buildPublishedScheduledPipesQuery()) as StepWithPublishedAt[]

  return steps.map((step) => ({
    flowId: step.flowId,
    publishedAt: step.publishedAt,
    triggerKey: step.key,
    triggerParameters: step.parameters,
  }))
}
