import type { IStepAiBuilderTool, IStepConfig } from '@plumber/types'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderTool,
): Pick<IStepConfig, 'aiBuilderConfig'> {
  return {
    aiBuilderConfig: [{ traceId, tool }],
  }
}

export function stampStepDeletedByAi(
  config: IStepConfig | null | undefined,
  traceId: string,
): IStepConfig {
  return {
    ...config,
    aiBuilderConfig: [
      ...(config?.aiBuilderConfig ?? []),
      { traceId, tool: 'delete_step' },
    ],
  }
}
