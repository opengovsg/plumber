import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { constructMsGraphValuesArrayForRowWrite } from '../../common/workbook-helpers/tables'

describe('constructMsGraphValuesArrayForRowWrite', () => {
  it('orders values by table column and leaves other columns null', () => {
    expect(
      constructMsGraphValuesArrayForRowWrite(
        ['Name', 'Age', 'City'],
        [
          { columnName: 'City', value: 'SG' },
          { columnName: 'Name', value: 'Alice' },
        ],
      ),
    ).toEqual(['Alice', null, 'SG'])
  })

  it('throws a config StepError when a column does not exist', () => {
    let error: unknown
    try {
      constructMsGraphValuesArrayForRowWrite(
        ['Name'],
        [{ columnName: 'Missing', value: 'x' }],
      )
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(JSON.parse((error as StepError).message)).toMatchObject({
      name: 'Column "Missing" does not exist in your table.',
      solution: "Remove this column from 'Row Data' section to proceed.",
    })
  })
})
