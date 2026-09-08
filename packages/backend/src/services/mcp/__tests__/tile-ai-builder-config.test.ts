import { describe, expect, it } from 'vitest'

import {
  appendAddTileColumnsAiBuilderConfig,
  createTileAiBuilderConfig,
} from '../tile-ai-builder-config'

describe('tile AI builder config', () => {
  it('stamps create_tile origin', () => {
    expect(createTileAiBuilderConfig('trace-1')).toEqual({
      aiBuilderConfig: {
        createTile: { traceId: 'trace-1' },
      },
    })
  })

  it('appends add_tile_columns without inventing createTile', () => {
    expect(
      appendAddTileColumnsAiBuilderConfig(null, {
        traceId: 'trace-2',
        addedColumnIds: ['col-a'],
      }),
    ).toEqual({
      aiBuilderConfig: {
        addTileColumns: [{ traceId: 'trace-2', addedColumnIds: ['col-a'] }],
      },
    })
  })

  it('keeps createTile when appending column adds', () => {
    const created = createTileAiBuilderConfig('trace-1')
    const firstAdd = appendAddTileColumnsAiBuilderConfig(created, {
      traceId: 'trace-2',
      addedColumnIds: ['col-a'],
    })
    expect(
      appendAddTileColumnsAiBuilderConfig(firstAdd, {
        traceId: 'trace-3',
        addedColumnIds: ['col-b', 'col-c'],
      }),
    ).toEqual({
      aiBuilderConfig: {
        createTile: { traceId: 'trace-1' },
        addTileColumns: [
          { traceId: 'trace-2', addedColumnIds: ['col-a'] },
          { traceId: 'trace-3', addedColumnIds: ['col-b', 'col-c'] },
        ],
      },
    })
  })
})
