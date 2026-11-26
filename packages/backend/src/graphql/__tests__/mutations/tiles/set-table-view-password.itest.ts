import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import setTableViewPassword from '@/graphql/mutations/tiles/set-table-view-password'
import { verifyTilePassword } from '@/helpers/auth-tiles'
import * as scrypt from '@/helpers/scrypt'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

import { generateMockContext, generateMockTable } from './table.mock'

const PASSWORD = 'correct-horse-battery'

describe('set table view password mutation', () => {
  let context: Context
  let table: TableMetadata

  beforeEach(async () => {
    context = await generateMockContext()
    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })
    table = await mockTable.table
      .$query()
      .patchAndFetch({ viewOnlyKey: randomUUID() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves a hash that verifies against the current link', async () => {
    await expect(
      setTableViewPassword(
        {},
        { input: { tableId: table.id, password: PASSWORD } },
        context,
      ),
    ).resolves.toBe(true)

    const saved = await TableMetadata.query().findById(table.id)
    expect(
      await verifyTilePassword(
        PASSWORD,
        saved!.viewOnlyPassword!.hash,
        saved!.viewOnlyKey!,
      ),
    ).toBe(true)
  })

  it('refuses to save when the link is replaced while hashing', async () => {
    const hashWithScrypt = scrypt.hashWithScrypt
    vi.spyOn(scrypt, 'hashWithScrypt').mockImplementationOnce(
      async (...args) => {
        await TableMetadata.query()
          .findById(table.id)
          .patch({ viewOnlyKey: randomUUID() })
        return hashWithScrypt(...args)
      },
    )

    await expect(
      setTableViewPassword(
        {},
        { input: { tableId: table.id, password: PASSWORD } },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)

    const saved = await TableMetadata.query().findById(table.id)
    expect(saved!.viewOnlyPassword).toBeNull()
  })
})
