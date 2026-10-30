import { randomUUID } from 'crypto'
import { DateTime } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { client } from '@/config/database'
import { tilesClient } from '@/config/tiles-database'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import logger from '@/helpers/logger'
import { _batchCreate } from '@/models/tiles/dynamodb/table-row/functions'
import { runNightly } from '@/models/tiles/migration/run-nightly'

const flags = vi.hoisted(() => ({ mode: 'migrate' }))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: async (flag: string) =>
    flag === 'tiles-ddb-migration' ? flags.mode : false,
}))

async function seedDdbTile(): Promise<string> {
  const context = await generateMockContext()
  const { table } = await generateMockTable({
    userId: context.currentUser.id,
    databaseType: 'ddb',
  })
  const [columnId] = await generateMockTableColumns({
    tableId: table.id,
    numColumns: 1,
    databaseType: 'ddb',
  })
  await client.raw(
    `UPDATE table_collaborators SET last_accessed_at = now() - INTERVAL '1 hour' WHERE table_id = ?`,
    [table.id],
  )
  await _batchCreate([
    { tableId: table.id, rowId: randomUUID(), data: { [columnId]: 'a' } },
    { tableId: table.id, rowId: randomUUID(), data: { [columnId]: 'b' } },
  ])
  return table.id
}

async function readTable(tableId: string) {
  const { rows } = await client.raw<{
    rows: { db: string; migration_started_at: Date | null }[]
  }>('SELECT db, migration_started_at FROM table_metadata WHERE id = ?', [
    tableId,
  ])
  return rows[0]
}

// Must not be earlier than database time, or claims look older than the commit cutoff.
function nextSgt(hour: number, minute: number, second: number): Date {
  const now = DateTime.now().setZone('Asia/Singapore')
  let at = now.set({ hour, minute, second, millisecond: 0 })
  if (at < now) {
    at = at.plus({ days: 1 })
  }
  return at.toJSDate()
}

/** Holds both active migrations in their drain until the test releases them. */
function makeDrainGate() {
  let release: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  let onBothDraining: () => void
  const bothDraining = new Promise<void>(
    (resolve) => (onBothDraining = resolve),
  )
  let calls = 0
  return {
    drain: () => {
      if (++calls === 2) {
        onBothDraining()
      }
      return gate
    },
    bothDraining,
    release: () => release(),
  }
}

describe('runNightly tile loop', () => {
  let tableIds: string[]
  let windowEnd: Date

  beforeEach(async () => {
    flags.mode = 'migrate'
    tableIds = [await seedDdbTile(), await seedDdbTile(), await seedDdbTile()]
    tableIds.sort()
    const beforeEnd = nextSgt(4, 59, 59)
    windowEnd = new Date(beforeEnd.getTime() + 1000)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(beforeEnd)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('finishes active migrations at 05:00 and claims no new tile', async () => {
    const infoSpy = vi.spyOn(logger, 'info')
    const { drain, bothDraining, release } = makeDrainGate()
    const run = runNightly({ drain })

    await bothDraining
    vi.setSystemTime(windowEnd)
    release()

    await expect(run).resolves.toEqual({
      status: 'ran',
      migrated: 2,
      skipped: 0,
      aborted: 0,
      failed: 0,
      remaining: 1,
      failedTableIds: [],
      abortedTableIds: [],
    })
    expect((await readTable(tableIds[0])).db).toBe('pg')
    expect((await readTable(tableIds[1])).db).toBe('pg')
    expect(await readTable(tableIds[2])).toEqual({
      db: 'ddb',
      migration_started_at: null,
    })
    expect(infoSpy).toHaveBeenCalledWith(
      'tiles-migration.run.completed',
      expect.objectContaining({ migrated: 2, failed: 0, aborted: 0 }),
    )
  })

  it('aborts active migrations and claims no new tile after the flag turns off', async () => {
    const infoSpy = vi.spyOn(logger, 'info')
    const { drain, bothDraining, release } = makeDrainGate()
    const run = runNightly({ drain })

    await bothDraining
    flags.mode = 'off'
    release()

    await expect(run).resolves.toEqual({
      status: 'ran',
      migrated: 0,
      skipped: 0,
      aborted: 2,
      failed: 0,
      remaining: 3,
      failedTableIds: [],
      abortedTableIds: expect.arrayContaining(tableIds.slice(0, 2)),
    })
    for (const tableId of tableIds) {
      expect(await readTable(tableId)).toEqual({
        db: 'ddb',
        migration_started_at: null,
      })
      await expect(tilesClient.schema.hasTable(tableId)).resolves.toBe(false)
    }
    for (const tableId of tableIds.slice(0, 2)) {
      expect(infoSpy).toHaveBeenCalledWith('tiles-migration.table.aborted', {
        tableId,
        err: 'Flag is no longer migrate',
      })
    }
    expect(infoSpy).toHaveBeenCalledWith(
      'tiles-migration.run.completed',
      expect.objectContaining({ migrated: 0, aborted: 2, remaining: 3 }),
    )
  })
})
