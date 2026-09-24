import type { IStepAiBuilderTool, IStepConfig } from '@plumber/types'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderTool,
): Pick<IStepConfig, 'aiBuilderConfig'> {
  return {
    aiBuilderConfig: { traceId, tool },
  }
}

export function stampStepDeletedByAi(
  config: IStepConfig | null | undefined,
  traceId: string,
): IStepConfig {
  const existing = config?.aiBuilderConfig
  const deleted = { traceId, tool: 'delete_step' as const }

  if (existing?.tool === 'create_pipe' || existing?.tool === 'create_step') {
    return {
      ...config,
      aiBuilderConfig: {
        ...existing,
        deleted,
      },
    }
  }

  return {
    ...config,
    aiBuilderConfig: { traceId, tool: 'delete_step' },
  }
}
