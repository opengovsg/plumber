import type { IStepAiBuilderConfig, IStepConfig } from '@plumber/types'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderConfig['tool'],
): IStepConfig {
  if (!traceId) {
    return {}
  }

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

export function setConnectionConflict(
  config: IStepConfig | null | undefined,
  connectionId: string,
  traceId?: string,
): IStepConfig {
  return {
    ...config,
    aiBuilderConnectionConflict: {
      connectionId,
      ...(traceId && { traceId }),
    },
  }
}

export function clearConnectionConflict(
  config: IStepConfig | null | undefined,
): IStepConfig {
  const next: IStepConfig = { ...config }
  delete next.aiBuilderConnectionConflict
  return next
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
