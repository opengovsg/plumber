import { describe, expect, it } from 'vitest'

import {
  actionCatalogTable,
  parseActionCatalog,
} from '../tables/action-catalog'

const HEADER = 'app_key,action_key,name,is_trigger,launched_at,minutes_saved'

describe('action_catalog', () => {
  it('reads the committed CSV', async () => {
    const rows = await actionCatalogTable.fetchRows({} as never)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows).toContainEqual({
      app_key: 'formsg',
      action_key: 'newSubmission',
      name: 'New form response',
      is_trigger: true,
      launched_at: null,
      minutes_saved: null,
      complexity: null,
    })
  })

  it('reads a launch date as Singapore midnight and minutes as a number', () => {
    const [row] = parseActionCatalog(
      `${HEADER}\ntiles,createTileRow,"Create row, fast",false,2024-03-01,5\n`,
    )

    expect(row).toMatchObject({
      name: 'Create row, fast',
      launched_at: new Date('2024-02-29T16:00:00.000Z'),
      minutes_saved: 5,
    })
  })

  it.each([
    ['a wrong header', 'app_key,action_key\ntiles,createTileRow'],
    [
      'a repeated app-action',
      `${HEADER}\ntiles,a,A,false,,\ntiles,a,B,false,,`,
    ],
    ['a bad trigger flag', `${HEADER}\ntiles,a,A,yes,,`],
    ['fractional minutes', `${HEADER}\ntiles,a,A,false,,1.5`],
    ['an impossible date', `${HEADER}\ntiles,a,A,false,2024-02-31,`],
  ])('rejects %s', (_case, text) => {
    expect(() => parseActionCatalog(text)).toThrow()
  })
})
