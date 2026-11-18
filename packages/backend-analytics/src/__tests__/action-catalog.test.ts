import { describe, expect, it } from 'vitest'

import { buildAgencyMapping } from '../agency/agency-mapping'
import {
  buildActionCatalog,
  firstExternalUse,
  parseActionCatalog,
  parseLaunchDates,
} from '../tables/action-catalog'

const CATALOG = parseActionCatalog(
  JSON.stringify([
    {
      app_key: 'tiles',
      action_key: 'createTileRow',
      name: 'Create row',
      is_trigger: false,
      is_active: true,
    },
    {
      app_key: 'formsg',
      action_key: 'newSubmission',
      name: 'New form response',
      is_trigger: true,
      is_active: true,
    },
  ]),
)

const MAPPING = buildAgencyMapping(
  'canonical,agency_name,category\nopen.gov.sg,Open Government Products,ogp\nmoe.gov.sg,Ministry of Education,ministry\n',
  'domain,canonical\nopen.gov.sg,open.gov.sg\nmoe.gov.sg,moe.gov.sg\n',
)

const HEADER = 'app_key,action_key,launched_at'

describe('action_catalog', () => {
  it('reads the generated catalog file', () => {
    expect(() =>
      parseActionCatalog(
        '[{"app_key":"a","action_key":"b","is_trigger":false}]',
      ),
    ).toThrow()
  })

  it('reads a manual launch date as Singapore midnight', () => {
    const dates = parseLaunchDates(
      `${HEADER}\ntiles,createTileRow,2024-03-01\n`,
      CATALOG,
    )

    expect(dates.get('tiles.createTileRow')).toEqual(
      new Date('2024-02-29T16:00:00.000Z'),
    )
  })

  it.each([
    ['a wrong header', 'app_key,launched_at\ntiles,2024-03-01'],
    ['an unknown app-action', `${HEADER}\ntiles,deleteTileRow,2024-03-01`],
    [
      'a repeated app-action',
      `${HEADER}\ntiles,createTileRow,2024-03-01\ntiles,createTileRow,2024-03-02`,
    ],
    ['an impossible date', `${HEADER}\ntiles,createTileRow,2024-02-31`],
    ['a blank date', `${HEADER}\ntiles,createTileRow,`],
  ])('rejects launch dates with %s', (_case, text) => {
    expect(() => parseLaunchDates(text, CATALOG)).toThrow()
  })

  it('skips pipes created by internal users when finding first use', () => {
    const firstUse = firstExternalUse(
      [
        {
          app_key: 'tiles',
          action_key: 'createTileRow',
          creator_email: 'dev@open.gov.sg',
          first_used_at: new Date('2024-01-01'),
        },
        {
          app_key: 'tiles',
          action_key: 'createTileRow',
          creator_email: 'teacher@moe.gov.sg',
          first_used_at: new Date('2024-02-01'),
        },
        {
          app_key: 'tiles',
          action_key: 'createTileRow',
          creator_email: 'other@unlisted.gov.sg',
          first_used_at: new Date('2024-03-01'),
        },
        {
          app_key: 'formsg',
          action_key: 'newSubmission',
          creator_email: 'dev@open.gov.sg',
          first_used_at: new Date('2024-01-01'),
        },
      ],
      MAPPING,
    )

    expect(firstUse).toEqual(
      new Map([['tiles.createTileRow', new Date('2024-02-01')]]),
    )
  })

  it('prefers a manual launch date over first use', () => {
    const rows = buildActionCatalog(
      CATALOG,
      new Map([
        ['tiles.createTileRow', new Date('2024-02-01')],
        ['formsg.newSubmission', new Date('2023-01-01')],
      ]),
      new Map([['tiles.createTileRow', new Date('2023-12-31')]]),
    )

    expect(rows).toEqual([
      expect.objectContaining({
        action_key: 'createTileRow',
        launched_at: new Date('2023-12-31'),
        launched_at_source: 'manual',
      }),
      expect.objectContaining({
        action_key: 'newSubmission',
        launched_at: new Date('2023-01-01'),
        launched_at_source: 'first_use',
        complexity: null,
      }),
    ])
  })
})
