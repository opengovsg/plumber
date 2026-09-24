import type { IStepAiBuilderConfig, IStepConfig } from '@plumber/types'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderConfig['tool'],
): Pick<IStepConfig, 'aiBuilderConfig'> {
  return {
    aiBuilderConfig: [{ traceId, tool }],
  }
}

export function appendStepAiBuilderEvent(
  config: IStepConfig | null | undefined,
  event: IStepAiBuilderConfig,
  options: { skipIfRecorded?: boolean } = {},
): IStepConfig {
  const events = config?.aiBuilderConfig ?? []
  if (
    options.skipIfRecorded &&
    events.some(
      (existing) =>
        existing.traceId === event.traceId && existing.tool === event.tool,
    )
  ) {
    return {
      ...config,
      aiBuilderConfig: events,
    }
  }

  return {
    ...config,
    aiBuilderConfig: [...events, event],
  }
}

export function stampStepDeletedByAi(
  config: IStepConfig | null | undefined,
  traceId: string,
): IStepConfig {
  return appendStepAiBuilderEvent(config, {
    traceId,
    tool: 'delete_step',
  })
}
