import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import verifyTableViewPassword from '@/graphql/mutations/tiles/verify-table-view-password'
import * as scrypt from '@/helpers/scrypt'
import { MAX_FAILED_ATTEMPTS } from '@/helpers/tiles-password-lockout'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import { generateMockContext, generateMockTable } from './table.mock'
import {
  enableViewPassword,
  generateViewOnlyContext,
  VIEW_PASSWORD,
} from './view-password.mock'

function verify(table: TableMetadata, context: Context, password: string) {
  return verifyTableViewPassword(
    {},
    { input: { tableId: table.id, password } },
    context,
  )
}

async function exhaustAttempts(table: TableMetadata, context: Context) {
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    await expect(verify(table, context, `wrong-${i}`)).rejects.toThrow(
      ForbiddenError,
    )
  }
}

describe('verify table view password mutation', () => {
  let table: TableMetadata
  let viewOnlyKey: string

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    const ownerContext = await generateMockContext()
    const mockTable = await generateMockTable({
      userId: ownerContext.currentUser.id,
      databaseType: 'pg',
    })
    table = mockTable.table
    viewOnlyKey = await enableViewPassword(table)
    table = (await TableMetadata.query().findById(table.id))!
  })

  it('issues a view token for the correct password', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.1',
    })
    await expect(verify(table, context, VIEW_PASSWORD)).resolves.toEqual(
      expect.any(String),
    )
  })

  it('locks out the client after the maximum number of failed attempts', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.2',
    })

    await exhaustAttempts(table, context)

    await expect(verify(table, context, 'wrong-again')).rejects.toThrow(
      RateLimitedError,
    )
  })

  it('does not spend an attempt when the hash queue is full', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.20',
    })
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await expect(verify(table, context, `wrong-${i}`)).rejects.toThrow(
        ForbiddenError,
      )
    }
    vi.spyOn(scrypt, 'hashWithScrypt').mockRejectedValueOnce(
      new RateLimitedError('Too many requests. Please try again shortly.'),
    )

    await expect(verify(table, context, VIEW_PASSWORD)).rejects.toThrow(
      'Too many requests',
    )

    // The last attempt is still available only if the rejection spent none.
    await expect(verify(table, context, VIEW_PASSWORD)).resolves.toEqual(
      expect.any(String),
    )
  })

  it('spends an attempt on a view key of a different length', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.23',
    })
    const shortKeyContext = generateViewOnlyContext({
      viewOnlyKey: 'short',
      clientIp: '10.0.0.23',
    })
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await expect(verify(table, context, `wrong-${i}`)).rejects.toThrow(
        ForbiddenError,
      )
    }

    await expect(verify(table, shortKeyContext, VIEW_PASSWORD)).rejects.toThrow(
      ForbiddenError,
    )

    await expect(verify(table, context, VIEW_PASSWORD)).rejects.toThrow(
      RateLimitedError,
    )
  })

  it('resets the failed attempt count once the password is correct', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.3',
    })

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await expect(verify(table, context, `wrong-${i}`)).rejects.toThrow(
        ForbiddenError,
      )
    }
    await expect(verify(table, context, VIEW_PASSWORD)).resolves.toEqual(
      expect.any(String),
    )

    // The full allowance is available again, so none of these are locked out.
    await exhaustAttempts(table, context)
  })

  it('locks out only the offending IP', async () => {
    const lockedOut = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.4',
    })
    const other = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.0.0.5',
    })

    await exhaustAttempts(table, lockedOut)
    await expect(verify(table, lockedOut, VIEW_PASSWORD)).rejects.toThrow(
      RateLimitedError,
    )

    await expect(verify(table, other, VIEW_PASSWORD)).resolves.toEqual(
      expect.any(String),
    )
  })

  it('locks out only the offending table', async () => {
    const ownerContext = await generateMockContext()
    const otherTable = (
      await generateMockTable({
        userId: ownerContext.currentUser.id,
        databaseType: 'pg',
      })
    ).table
    const otherViewOnlyKey = await enableViewPassword(otherTable)

    const clientIp = '10.0.0.6'
    await exhaustAttempts(
      table,
      generateViewOnlyContext({ viewOnlyKey, clientIp }),
    )

    await expect(
      verify(
        otherTable,
        generateViewOnlyContext({ viewOnlyKey: otherViewOnlyKey, clientIp }),
        VIEW_PASSWORD,
      ),
    ).resolves.toEqual(expect.any(String))
  })
})
