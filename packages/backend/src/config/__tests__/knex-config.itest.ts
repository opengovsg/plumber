import path from 'node:path'

import knex, { type Knex } from 'knex'
import pg from 'pg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BIGINT_OID = 20
const COUNT_QUERY = 'SELECT count(*) AS n FROM (VALUES (1), (2)) AS t'

describe('bigint parsing', () => {
  // Earlier imports already set the parser globally, so each test must prove
  // its own entry point sets it.
  beforeEach(() => {
    pg.types.setTypeParser(BIGINT_OID, 'text', (value) => value)
    vi.resetModules()
  })

  afterEach(() => {
    pg.types.setTypeParser(BIGINT_OID, 'text', parseInt)
  })

  it('returns counts as numbers from the app client', async () => {
    const { client } = await import('@/config/database.js')

    try {
      const { rows } = await client.raw(COUNT_QUERY)
      expect(rows[0].n).toBe(2)
    } finally {
      await client.destroy()
    }
  })

  it('returns counts as numbers from the knexfile config', async () => {
    // knexfile.ts sits outside rootDir, so a literal import cannot be checked.
    const specifier = path.join(__dirname, '../../../knexfile.ts')
    const { default: config } = (await import(specifier)) as {
      default: Knex.Config
    }
    const client = knex(config)

    try {
      const { rows } = await client.raw(COUNT_QUERY)
      expect(rows[0].n).toBe(2)
    } finally {
      await client.destroy()
    }
  })
})
