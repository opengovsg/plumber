/**
 * Business rules pinned by this file:
 *
 * 1. "A viewer who has exhausted the allowance of guesses is refused even when
 *    the password is correct."
 *
 * The attempt is counted before the password is compared, so a correct guess
 * cannot buy its way out of an exhausted allowance.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import verifyTableViewPassword from '@/graphql/mutations/tiles/verify-table-view-password'
import { MAX_FAILED_ATTEMPTS } from '@/helpers/tiles-password-lockout'
import TableMetadata from '@/models/table-metadata'

import { generateMockContext, generateMockTable } from './table.mock'
import {
  enableViewPassword,
  generateViewOnlyContext,
  VIEW_PASSWORD,
} from './view-password.mock'

describe('verify table view password lockout', () => {
  let table: TableMetadata
  let viewOnlyKey: string

  beforeEach(async () => {
    const ownerContext = await generateMockContext()
    const mockTable = await generateMockTable({
      userId: ownerContext.currentUser.id,
      databaseType: 'pg',
    })
    table = mockTable.table
    viewOnlyKey = await enableViewPassword(table)
    table = await TableMetadata.query().findById(table.id)
  })

  it('refuses the correct password once the allowance is exhausted', async () => {
    const context = generateViewOnlyContext({
      viewOnlyKey,
      clientIp: '10.1.0.1',
    })

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await expect(
        verifyTableViewPassword(
          null,
          { input: { tableId: table.id, password: `wrong-${i}` } },
          context,
        ),
      ).rejects.toThrow(ForbiddenError)
    }

    await expect(
      verifyTableViewPassword(
        null,
        { input: { tableId: table.id, password: VIEW_PASSWORD } },
        context,
      ),
    ).rejects.toThrow(RateLimitedError)
  })
})
