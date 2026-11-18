import { describe, expect, it } from 'vitest'

import {
  actionCatalogTable,
  parseActionCatalog,
} from '../tables/action-catalog'

const HEADER = 'app_key,action_key,name,is_trigger,is_active,launched_at'

describe('action_catalog', () => {
  it('reads the committed catalog', async () => {
    const rows = await actionCatalogTable.fetchRows({} as never)

    expect(rows).toContainEqual(
      expect.objectContaining({
        app_key: 'formsg',
        action_key: 'newSubmission',
        name: 'New form response',
        is_trigger: true,
        is_active: true,
        complexity: null,
      }),
    )
  })

  it('reads a launch date as Singapore midnight and a blank date as null', () => {
    const rows = parseActionCatalog(
      `${HEADER}\ntiles,createTileRow,"Create row, fast",false,true,2024-03-01\ntiles,a,A,false,false,\n`,
    )

    expect(rows).toMatchObject([
      {
        name: 'Create row, fast',
        is_active: true,
        launched_at: new Date('2024-02-29T16:00:00.000Z'),
      },
      { is_active: false, launched_at: null },
    ])
  })

  it.each([
    ['a wrong header', 'app_key,action_key\ntiles,createTileRow'],
    [
      'a repeated app-action',
      `${HEADER}\ntiles,a,A,false,true,\ntiles,a,B,false,true,`,
    ],
    ['a bad flag', `${HEADER}\ntiles,a,A,yes,true,`],
    ['an impossible date', `${HEADER}\ntiles,a,A,false,true,2024-02-31`],
  ])('rejects %s', (_case, text) => {
    expect(() => parseActionCatalog(text)).toThrow()
  })
})
