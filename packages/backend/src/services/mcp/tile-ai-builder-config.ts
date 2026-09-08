import type {
  ITableColumnAiBuilderTool,
  ITableColumnConfig,
  ITableConfig,
} from '@plumber/types'

export function createTileAiBuilderConfig(traceId: string): ITableConfig {
  return {
    aiBuilderConfig: { traceId },
  }
}

export function createColumnAiBuilderConfig(
  traceId: string,
  tool: ITableColumnAiBuilderTool,
): ITableColumnConfig {
  return {
    aiBuilderConfig: { traceId, tool },
  }
}
