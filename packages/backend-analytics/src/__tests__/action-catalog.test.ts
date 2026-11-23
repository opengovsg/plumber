import { describe, expect, it } from 'vitest'

import {
  actionCatalogTable,
  parseActionCatalog,
  resourceParameters,
} from '../tables/action-catalog'

const HEADER =
  'app_key,action_key,name,is_trigger,is_active,resource_parameter,launched_at'

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
        resource_parameter: null,
        complexity: null,
      }),
    )
  })

  it('maps each app-action with a resource to its argument', () => {
    const rows = parseActionCatalog(
      `${HEADER}\ntiles,createTileRow,Create row,false,true,tableId,\nslack,findMessage,Find,false,true,none,\n`,
    )

    expect(resourceParameters(rows)).toEqual({
      'tiles.createTileRow': 'tableId',
    })
  })

  it('reads a launch date as Singapore midnight and a blank date as null', () => {
    const rows = parseActionCatalog(
      `${HEADER}\ntiles,createTileRow,"Create row, fast",false,true,tableId,2024-03-01\ntiles,a,A,false,false,none,\n`,
    )

    expect(rows).toMatchObject([
      {
        name: 'Create row, fast',
        is_active: true,
        resource_parameter: 'tableId',
        launched_at: new Date('2024-02-29T16:00:00.000Z'),
      },
      { is_active: false, resource_parameter: null, launched_at: null },
    ])
  })

  it.each([
    ['a wrong header', 'app_key,action_key\ntiles,createTileRow'],
    [
      'a repeated app-action',
      `${HEADER}\ntiles,a,A,false,true,none,\ntiles,a,B,false,true,none,`,
    ],
    ['a bad flag', `${HEADER}\ntiles,a,A,yes,true,none,`],
    ['an impossible date', `${HEADER}\ntiles,a,A,false,true,none,2024-02-31`],
    ['a blank resource parameter', `${HEADER}\ntiles,a,A,false,true,,`],
  ])('rejects %s', (_case, text) => {
    expect(() => parseActionCatalog(text)).toThrow()
  })
})
