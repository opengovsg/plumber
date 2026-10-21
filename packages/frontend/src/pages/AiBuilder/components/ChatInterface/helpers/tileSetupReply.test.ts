import { describe, expect, it } from 'vitest'

import { buildTileSetupReply } from './tileSetupReply'

describe('buildTileSetupReply', () => {
  it('includes name and columns', () => {
    expect(
      buildTileSetupReply('Review the tile', 'Leave applications', [
        'Name',
        'Start date',
      ]),
    ).toBe(
      [
        'Q: Review the tile',
        'A:',
        'NAME: Leave applications',
        'COLUMNS:',
        '- Name',
        '- Start date',
      ].join('\n'),
    )
  })

  it('omits NAME when creating columns on an existing tile', () => {
    expect(buildTileSetupReply('Add columns', null, ['Notes'])).toBe(
      ['Q: Add columns', 'A:', 'COLUMNS:', '- Notes'].join('\n'),
    )
  })

  it('drops blank column names', () => {
    expect(
      buildTileSetupReply('Review the tile', 'Tile', ['Name', '  ', 'Status']),
    ).toBe(
      [
        'Q: Review the tile',
        'A:',
        'NAME: Tile',
        'COLUMNS:',
        '- Name',
        '- Status',
      ].join('\n'),
    )
  })
})
