import { describe, expect, it } from 'vitest'

import { toResourceId } from '../tables/flow-step'

describe('toResourceId', () => {
  it.each([
    ['tiles', 'table-1', 'table-1'],
    ['tiles', '{{step.abc.tableId}}', null],
    ['tiles', null, null],
    [
      'custom-api',
      'https://api.example.gov.sg/users/42?key=x',
      'api.example.gov.sg',
    ],
    [
      'custom-api',
      'https://api.example.gov.sg/cases/{{step.abc.id}}',
      'api.example.gov.sg',
    ],
    ['custom-api', 'https://{{step.abc.host}}/users', null],
    ['custom-api', 'https://api.{{step.abc.env}}.gov.sg/users', null],
    ['custom-api', 'not a url', null],
  ])('maps %s %s to %s', (appKey, value, expected) => {
    expect(toResourceId(appKey, value)).toBe(expected)
  })
})
