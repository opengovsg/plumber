import { describe, expect, it } from 'vitest'

import { isTilesListTablesPicker } from './isTilesListTablesPicker'

const TILES_STEP = { id: 'tile-step', appKey: 'tiles' }
const EXCEL_STEP = { id: 'excel-step', appKey: 'm365-excel' }

describe('isTilesListTablesPicker', () => {
  it('is true for a Tiles listTables step picker', () => {
    expect(
      isTilesListTablesPicker(
        {
          question: 'Which Tile?',
          stepId: TILES_STEP.id,
          key: 'listTables',
        },
        [TILES_STEP, EXCEL_STEP],
      ),
    ).toBe(true)
  })

  it('is false for an Excel listTables step picker', () => {
    expect(
      isTilesListTablesPicker(
        {
          question: 'Which table?',
          stepId: EXCEL_STEP.id,
          key: 'listTables',
        },
        [TILES_STEP, EXCEL_STEP],
      ),
    ).toBe(false)
  })

  it('is false for a Tiles listColumns picker', () => {
    expect(
      isTilesListTablesPicker(
        {
          question: 'Which column?',
          stepId: TILES_STEP.id,
          key: 'listColumns',
        },
        [TILES_STEP],
      ),
    ).toBe(false)
  })

  it('is false for appKey connection pickers', () => {
    expect(
      isTilesListTablesPicker(
        { question: 'Which connection?', appKey: 'tiles' },
        [TILES_STEP],
      ),
    ).toBe(false)
  })

  it('is false when the step is missing from the pipe', () => {
    expect(
      isTilesListTablesPicker(
        {
          question: 'Which Tile?',
          stepId: 'unknown-step',
          key: 'listTables',
        },
        [TILES_STEP],
      ),
    ).toBe(false)
  })
})
