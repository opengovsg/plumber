import type { ITableConfig } from '@plumber/types'

import { raw } from 'objection'

export function createTileAiBuilderConfig(traceId: string): ITableConfig {
  return {
    aiBuilderConfig: {
      createTile: { traceId },
    },
  }
}

/**
 * Appends in SQL so two parallel MCP calls cannot overwrite each other's record.
 */
export function appendAddTileColumnsConfigPatch(entry: {
  traceId: string
  addedColumnIds: string[]
}) {
  return raw(
    `jsonb_set(
      jsonb_set(
        config,
        '{aiBuilderConfig}',
        COALESCE(config->'aiBuilderConfig', '{}'::jsonb),
        true
      ),
      '{aiBuilderConfig,addTileColumns}',
      COALESCE(config->'aiBuilderConfig'->'addTileColumns', '[]'::jsonb)
        || jsonb_build_array(?::jsonb),
      true
    )`,
    [JSON.stringify(entry)],
  )
}
