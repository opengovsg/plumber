import { describe, expect, it } from 'vitest'

import {
  appendAddTileColumnsConfigPatch,
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

  it('appends add_tile_columns with a SQL jsonb concat', () => {
    const patch = appendAddTileColumnsConfigPatch({
      traceId: 'trace-2',
      addedColumnIds: ['col-a'],
    })
    expect(JSON.stringify(patch)).toContain('jsonb_build_array')
    expect(JSON.stringify(patch)).toContain('aiBuilderConfig')
    expect(JSON.stringify(patch)).toContain('trace-2')
    expect(JSON.stringify(patch)).toContain('col-a')
  })
})
