import { parquetMetadata, parquetReadObjects } from 'hyparquet'
import { describe, expect, it } from 'vitest'

import { buildSilverKey, encodeSilverTable } from '../silver-table'
import {
  type FlowTransferRow,
  flowTransferTable,
} from '../tables/flow-transfer'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

const rows: FlowTransferRow[] = [
  {
    flow_id: 'flow-1',
    old_owner_user_id: 'user-old',
    new_owner_user_id: 'user-new',
    status: 'approved',
    created_at: new Date('2026-10-01T02:00:00.000Z'),
    updated_at: new Date('2026-10-02T03:00:00.000Z'),
  },
  {
    flow_id: 'flow-2',
    old_owner_user_id: 'user-a',
    new_owner_user_id: 'user-b',
    status: 'pending',
    created_at: new Date('2026-10-05T00:00:00.000Z'),
    updated_at: new Date('2026-10-05T00:00:00.000Z'),
  },
]

describe('encodeSilverTable', () => {
  it('reads back the same rows it wrote', async () => {
    const file = toArrayBuffer(encodeSilverTable(flowTransferTable, rows))

    const readBack = await parquetReadObjects({ file })

    expect(readBack).toHaveLength(rows.length)
    expect(readBack[0]).toEqual(rows[0])
    expect(readBack[1]).toEqual(rows[1])
  })

  it('writes every declared column with its type when there are no rows', () => {
    const file = toArrayBuffer(encodeSilverTable(flowTransferTable, []))

    const metadata = parquetMetadata(file)

    expect(Number(metadata.num_rows)).toBe(0)
    expect(metadata.schema.slice(1).map((column) => column.name)).toEqual(
      Object.keys(flowTransferTable.columns),
    )
    const createdAt = metadata.schema.find((c) => c.name === 'created_at')
    expect(createdAt?.converted_type).toBe('TIMESTAMP_MILLIS')
  })
})

describe('buildSilverKey', () => {
  it('writes one fixed file per table under silver/', () => {
    expect(buildSilverKey('flow_transfer')).toBe(
      'silver/flow_transfer/current.parquet',
    )
  })
})
