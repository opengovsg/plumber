import type { IStepAiBuilderTool, IStepConfig } from '@plumber/types'

import { raw } from 'objection'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderTool,
): Pick<IStepConfig, 'aiBuilderConfig'> {
  return {
    aiBuilderConfig: { traceId, tool },
  }
}

export function appendDeletedStepAiBuilderPatch(deletedStep: {
  stepId: string
  appKey: string | null
  key: string | null
  position: number
  traceId: string
  createdByTool?: IStepAiBuilderTool
}) {
  return raw(
    `jsonb_set(
       COALESCE(config, '{}'::jsonb),
       '{aiBuilderConfig,deletedSteps}',
       COALESCE(config #> '{aiBuilderConfig,deletedSteps}', '[]'::jsonb)
         || ?::jsonb,
       true
     )`,
    [JSON.stringify([deletedStep])],
  )
}
