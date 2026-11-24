import pg from 'pg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { archivalDb, archivalDbReader } from '../db'

const PRIVATE_VALUE = 'alice@example.com'

function invalidUuidError(): pg.DatabaseError {
  const err = new pg.DatabaseError(
    `invalid input syntax for type uuid: "${PRIVATE_VALUE}"`,
    0,
    'error',
  )
  err.code = '22P02'
  err.routine = 'string_to_uuid'
  err.detail = `Key (id)=(${PRIVATE_VALUE}) is invalid.`
  err.where = `unnamed portal parameter $1 = '${PRIVATE_VALUE}'`
  return err
}

async function queryError(
  query: PromiseLike<unknown>,
): Promise<pg.DatabaseError> {
  try {
    await query
  } catch (err) {
    return err as pg.DatabaseError
  }
  throw new Error('Expected the query to fail')
}

describe('archival db query errors', () => {
  beforeEach(() => {
    // Transactions run queries on a client built from the prototype, so stub it there.
    const clientPrototype = Object.getPrototypeOf(archivalDb.client)
    vi.spyOn(clientPrototype, '_query').mockImplementation(
      async (
        _connection: unknown,
        query: { sql: string; response?: unknown },
      ) => {
        if (query.sql.startsWith('UPDATE') || query.sql.startsWith('select')) {
          throw invalidUuidError()
        }
        query.response = { rows: [], rowCount: 0 }
        return query
      },
    )
    for (const db of [archivalDb, archivalDbReader]) {
      vi.spyOn(db.client, 'acquireConnection').mockResolvedValue({
        __knexUid: 'test-connection',
      })
      vi.spyOn(db.client, 'releaseConnection').mockResolvedValue(undefined)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function expectRedacted(err: pg.DatabaseError): void {
    expect(err).toBeInstanceOf(pg.DatabaseError)
    expect(err.code).toBe('22P02')
    expect(err.detail).toBeUndefined()
    expect(err.where).toBeUndefined()
    expect(`${err.message} ${err.stack}`).not.toContain(PRIVATE_VALUE)
  }

  it('keeps the bound value out of a raw query error inside a transaction', async () => {
    const err = await queryError(
      archivalDb.transaction((trx) =>
        trx.raw('UPDATE flows SET config = ? WHERE id = ?', [
          '{}',
          PRIVATE_VALUE,
        ]),
      ),
    )

    expectRedacted(err)
    expect(err.message).toBe(
      'PostgreSQL raw failed with SQLSTATE 22P02 (routine=string_to_uuid)',
    )
  })

  it('keeps the bound value out of a reader query error', async () => {
    const err = await queryError(
      archivalDbReader('executions').where('id', PRIVATE_VALUE),
    )

    expectRedacted(err)
    expect(err.message).toBe(
      'PostgreSQL select failed with SQLSTATE 22P02 (routine=string_to_uuid)',
    )
  })
})
