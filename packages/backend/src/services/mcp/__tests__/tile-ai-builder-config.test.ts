import { describe, expect, it } from 'vitest'

import {
  createColumnAiBuilderConfig,
  createTileAiBuilderConfig,
} from '../tile-ai-builder-config'

describe('tile AI builder config', () => {
  it('stamps create_tile origin', () => {
    expect(createTileAiBuilderConfig('trace-1')).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-1',
      },
    })
  })

  it('stamps column origin', () => {
    expect(
      createColumnAiBuilderConfig('trace-2', 'add_tile_columns'),
    ).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-2',
        tool: 'add_tile_columns',
      },
    })
  })
})
