import { describe, expect, it } from 'vitest'

import { parseTileSetupBlock } from './parse-tile-setup-block'

const makeBlock = (inner: string) => `<!-- TILE_SETUP_DATA\n${inner}\n-->`

describe('parseTileSetupBlock', () => {
  it('parses a create-tile block with name and columns', () => {
    const text = makeBlock(
      [
        'Q: Review the name and columns, then create.',
        'NAME: Leave applications',
        'COLUMNS:',
        '- Applicant name',
        '- Start date',
      ].join('\n'),
    )

    expect(parseTileSetupBlock(text)).toEqual({
      question: 'Review the name and columns, then create.',
      name: 'Leave applications',
      columns: ['Applicant name', 'Start date'],
    })
  })

  it('parses a columns-only block when NAME is omitted', () => {
    const text = makeBlock(
      [
        'Q: Add these columns?',
        'COLUMNS:',
        '- Notes',
      ].join('\n'),
    )

    expect(parseTileSetupBlock(text)).toEqual({
      question: 'Add these columns?',
      name: null,
      columns: ['Notes'],
    })
  })

  it('returns null when Q: is missing', () => {
    const text = makeBlock(['NAME: Tile', 'COLUMNS:', '- A'].join('\n'))
    expect(parseTileSetupBlock(text)).toBeNull()
  })

  it('returns null when there are no columns', () => {
    const text = makeBlock(
      ['Q: Review', 'NAME: Tile', 'COLUMNS:'].join('\n'),
    )
    expect(parseTileSetupBlock(text)).toBeNull()
  })

  it('returns null when no TILE_SETUP_DATA block is present', () => {
    expect(parseTileSetupBlock('Some normal text')).toBeNull()
  })
})
