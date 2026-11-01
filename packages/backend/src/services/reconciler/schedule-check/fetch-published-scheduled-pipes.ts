import type { IJSONObject } from '@plumber/types'

import schedulerApp from '@/apps/scheduler'
import BaseStep from '@/models/step/base'

export interface PublishedScheduledPipe {
  flowId: string
  publishedAt: string
  triggerKey: string
  triggerParameters: IJSONObject
}

export type PublishedScheduledPipeRow = Pick<
  BaseStep,
  'flowId' | 'key' | 'parameters' | 'version'
> &
  Pick<BaseStep['flow'], 'publishedAt'>

// BaseStep, not Step: Step imports every app, and some apps open Redis clients at import.
export function buildPublishedScheduledPipesQuery() {
  return BaseStep.query()
    .joinRelated('flow')
    .select(
      'steps.flow_id',
      'steps.key',
      'steps.parameters',
      'steps.version',
      'flow.published_at',
    )
    .where('flow.active', true)
    .where('steps.type', 'trigger')
    .where('steps.app_key', schedulerApp.key)
    .whereIn(
      'steps.key',
      schedulerApp.triggers.map((trigger) => trigger.key),
    )
    .castTo<PublishedScheduledPipeRow[]>()
}

// Step's $afterFind applies the transform, and BaseStep skips it.
export function toPublishedScheduledPipe(
  row: PublishedScheduledPipeRow,
  stepTransformer = schedulerApp.stepTransformer,
): PublishedScheduledPipe {
  return {
    flowId: row.flowId,
    publishedAt: row.publishedAt,
    triggerKey: row.key,
    triggerParameters: stepTransformer
      ? stepTransformer.transformStepParameters(
          row.key,
          row.parameters,
          row.version,
        )
      : row.parameters,
  }
}

export async function fetchPublishedScheduledPipes(): Promise<
  PublishedScheduledPipe[]
> {
  const rows = await buildPublishedScheduledPipesQuery()
  return rows.map((row) => toPublishedScheduledPipe(row))
}
