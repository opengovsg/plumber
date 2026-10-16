import type { IField } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import {
  areRowsComplete,
  isGroupedMultiRowComplete,
  isRowComplete,
} from '../grouped-multirow-validation'

// Mirrors the toolbox condition row: field/is/condition required, value (text)
// required but hidden for the unary `empty` operator.
const CONDITION_SUBFIELDS: IField[] = [
  { key: 'field', type: 'string', required: true },
  { key: 'is', type: 'dropdown', required: true },
  { key: 'condition', type: 'dropdown', required: true },
  {
    key: 'text',
    type: 'string',
    required: true,
    hiddenIf: { fieldKey: 'condition', op: 'equals', fieldValue: 'empty' },
  },
] as IField[]

const completeRow = { field: 'a', is: 'is', condition: 'equals', text: 'a' }
const emptyOperatorRow = { field: 'a', is: 'is', condition: 'empty', text: '' }
const incompleteRow = { field: 'a', is: 'is', condition: 'equals', text: '' }

describe('isRowComplete', () => {
  it('is true when all required subfields are filled', () => {
    expect(isRowComplete(completeRow, CONDITION_SUBFIELDS)).toBe(true)
  })

  it('is false when a required subfield is empty', () => {
    expect(isRowComplete(incompleteRow, CONDITION_SUBFIELDS)).toBe(false)
  })

  it('skips the value field for the unary `empty` operator', () => {
    // text is empty but hidden, so the row is still complete.
    expect(isRowComplete(emptyOperatorRow, CONDITION_SUBFIELDS)).toBe(true)
  })
})

describe('areRowsComplete', () => {
  it('is false for no rows', () => {
    expect(areRowsComplete([], CONDITION_SUBFIELDS)).toBe(false)
  })

  it('requires every row to be complete (AND semantics)', () => {
    expect(
      areRowsComplete([completeRow, completeRow], CONDITION_SUBFIELDS),
    ).toBe(true)
    expect(
      areRowsComplete([completeRow, incompleteRow], CONDITION_SUBFIELDS),
    ).toBe(false)
  })
})

describe('isGroupedMultiRowComplete', () => {
  it('is false when there are no groups', () => {
    expect(isGroupedMultiRowComplete([], CONDITION_SUBFIELDS)).toBe(false)
  })

  it('is false when any group is empty', () => {
    expect(
      isGroupedMultiRowComplete(
        [{ rows: [completeRow] }, { rows: [] }],
        CONDITION_SUBFIELDS,
      ),
    ).toBe(false)
  })

  it('is false when any group has an incomplete row', () => {
    expect(
      isGroupedMultiRowComplete(
        [{ rows: [completeRow] }, { rows: [completeRow, incompleteRow] }],
        CONDITION_SUBFIELDS,
      ),
    ).toBe(false)
  })

  it('is true when every group has only complete rows', () => {
    expect(
      isGroupedMultiRowComplete(
        [{ rows: [completeRow, completeRow] }, { rows: [emptyOperatorRow] }],
        CONDITION_SUBFIELDS,
      ),
    ).toBe(true)
  })
})
