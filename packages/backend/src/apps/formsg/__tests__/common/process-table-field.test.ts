import { describe, expect, it } from 'vitest'

import convertTableAnswerArrayToTableObject from '../../common/process-table-field'

const COL_1_ID = Buffer.from('Col 1').toString('hex')
const COL_2_ID = Buffer.from('Col 2').toString('hex')

function columnsOf(tableObject: string) {
  return JSON.parse(tableObject).columns.map(
    ({ id, label }: { id: string; label: string }) => ({ id, label }),
  )
}

describe('convertTableAnswerArrayToTableObject', () => {
  it.each([
    ['an empty', []],
    ['a filled', [['a', '1']]],
  ])('uses column titles over the question for %s table', (_, answerArray) => {
    expect(
      columnsOf(
        convertTableAnswerArrayToTableObject(
          'Items (Name (optional, Qty)',
          answerArray,
          ['Name (optional', 'Qty'],
        ),
      ),
    ).toEqual([
      { id: COL_1_ID, label: 'Name (optional' },
      { id: COL_2_ID, label: 'Qty' },
    ])
  })

  it('falls back to Col N when column titles do not match the row length', () => {
    expect(
      columnsOf(
        convertTableAnswerArrayToTableObject(
          'Items (Name, Qty)',
          [['a', '1']],
          ['Name'],
        ),
      ),
    ).toEqual([
      { id: COL_1_ID, label: 'Col 1' },
      { id: COL_2_ID, label: 'Col 2' },
    ])
  })
})
