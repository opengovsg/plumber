import { describe, expect, it } from 'vitest'

import type { ColumnTableData } from '@/hooks/useChatStream'

import {
  buildColumnTableReply,
  buildEditableRows,
  type EditableColumnRow,
} from './columnTableReply'

const sampleData: ColumnTableData = {
  question: 'Review the columns',
  stepId: 'step-uuid-123',
  field: 'rowData',
  rows: [
    { id: 'col-a', name: 'Name', draft: 'the submission name', include: true },
    { id: 'col-b', name: 'Status', draft: '', include: false },
  ],
}

describe('buildEditableRows', () => {
  it('maps draft/include to editable value/checked state', () => {
    expect(buildEditableRows(sampleData)).toEqual([
      {
        id: 'col-a',
        name: 'Name',
        value: 'the submission name',
        checked: true,
      },
      { id: 'col-b', name: 'Status', value: '', checked: false },
    ])
  })
})

describe('buildColumnTableReply', () => {
  it('includes only checked rows, in order', () => {
    const rows: EditableColumnRow[] = [
      {
        id: 'col-a',
        name: 'Name',
        value: 'the submission name',
        checked: true,
      },
      { id: 'col-b', name: 'Status', value: 'urgent', checked: false },
    ]

    expect(buildColumnTableReply('Review the columns', rows)).toBe(
      'Q: Review the columns\nA:\n- Name (id: col-a): the submission name',
    )
  })

  it('reflects an edited value for a checked row', () => {
    const rows: EditableColumnRow[] = [
      { id: 'col-a', name: 'Name', value: 'a different value', checked: true },
    ]

    expect(buildColumnTableReply('Review the columns', rows)).toBe(
      'Q: Review the columns\nA:\n- Name (id: col-a): a different value',
    )
  })

  it('returns "none" when no rows are checked', () => {
    const rows: EditableColumnRow[] = [
      {
        id: 'col-a',
        name: 'Name',
        value: 'the submission name',
        checked: false,
      },
    ]

    expect(buildColumnTableReply('Review the columns', rows)).toBe(
      'Q: Review the columns\nA: none',
    )
  })
})
