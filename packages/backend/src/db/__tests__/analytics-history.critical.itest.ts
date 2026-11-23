import { describe, expect, it } from 'vitest'

import { client } from '@/config/database'

/**
 * BUSINESS-CRITICAL TESTS. This file pins down the rule:
 *
 *   Never hard-delete rows from `users` or `flows`. A purge needs a plan that
 *   first copies the rows' analytics facts, without emails, to the analytics
 *   bucket's `bronze/`.
 *
 * The nightly analytics export overwrites `dim_user` and the pipe tables, so a
 * cascading delete erases that history with no error. STOP and confirm with
 * the user before loosening or deleting the assertion below.
 */
describe('analytics history', () => {
  it('no foreign key deletes or nulls rows when a user or pipe is deleted', async () => {
    const { rows } = await client.raw<{
      rows: { constraint: string; table: string }[]
    }>(
      `SELECT conname AS constraint, conrelid::regclass::text AS table
       FROM pg_constraint
       WHERE contype = 'f'
         AND confrelid IN ('users'::regclass, 'flows'::regclass)
         AND confdeltype NOT IN ('a', 'r')
       ORDER BY 2, 1`,
    )
    expect(rows).toEqual([])
  })
})
