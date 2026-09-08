import type { ITableConfig } from '@plumber/types'

export function createTileAiBuilderConfig(traceId: string): ITableConfig {
  return {
    aiBuilderConfig: {
      createTile: { traceId },
    },
  }
}

export function appendAddTileColumnsAiBuilderConfig(
  config: ITableConfig | null | undefined,
  entry: { traceId: string; addedColumnIds: string[] },
): ITableConfig {
  return {
    ...config,
    aiBuilderConfig: {
      ...config?.aiBuilderConfig,
      addTileColumns: [
        ...(config?.aiBuilderConfig?.addTileColumns ?? []),
        entry,
      ],
    },
  }
}
