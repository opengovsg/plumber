// packages/backend/src/routes/api/chat/parse-column-table-block.test.ts
import { describe, expect, it } from 'vitest'

import { parseColumnTableBlock } from './parse-column-table-block'

const STEP_ID = '123e4567-e89b-12d3-a456-426614174000'

const makeBlock = (inner: string) => `<!-- COLUMN_TABLE_DATA\n${inner}\n-->`

describe('parseColumnTableBlock', () => {
  it('returns correct data for a valid block with multiple rows', () => {
    const text = makeBlock(
      [
        'Q: Review the columns',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: the submission ID, INCLUDE: true',
        '- ID: col-b, NAME: Status, DRAFT: , INCLUDE: false',
      ].join('\n'),
    )

    expect(parseColumnTableBlock(text)).toEqual({
      question: 'Review the columns',
      stepId: STEP_ID,
      field: 'rowData',
      rows: [
        {
          id: 'col-a',
          name: 'Name',
          draft: 'the submission ID',
          include: true,
        },
        { id: 'col-b', name: 'Status', draft: '', include: false },
      ],
    })
  })

  it('parses questions containing colons correctly', () => {
    const text = makeBlock(
      [
        'Q: Review: does this look right?',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )

    expect(parseColumnTableBlock(text)?.question).toBe(
      'Review: does this look right?',
    )
  })

  it('parses a NAME containing a comma correctly', () => {
    const text = makeBlock(
      [
        'Q: Review',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Last, First, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )

    expect(parseColumnTableBlock(text)?.rows).toEqual([
      { id: 'col-a', name: 'Last, First', draft: 'value', include: true },
    ])
  })

  it('parses a DRAFT containing a comma correctly', () => {
    const text = makeBlock(
      [
        'Q: Review',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: Singapore, SG, INCLUDE: true',
      ].join('\n'),
    )

    expect(parseColumnTableBlock(text)?.rows).toEqual([
      { id: 'col-a', name: 'Name', draft: 'Singapore, SG', include: true },
    ])
  })

  it('parses INCLUDE true/false case-insensitively', () => {
    const text = makeBlock(
      [
        'Q: Review',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: True',
        '- ID: col-b, NAME: Status, DRAFT: , INCLUDE: FALSE',
      ].join('\n'),
    )

    expect(parseColumnTableBlock(text)?.rows).toEqual([
      { id: 'col-a', name: 'Name', draft: 'value', include: true },
      { id: 'col-b', name: 'Status', draft: '', include: false },
    ])
  })

  it('returns null when Q: is missing', () => {
    const text = makeBlock(
      [
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )
    expect(parseColumnTableBlock(text)).toBeNull()
  })

  it('returns null when STEP_ID: is missing', () => {
    const text = makeBlock(
      [
        'Q: Review',
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )
    expect(parseColumnTableBlock(text)).toBeNull()
  })

  it('returns null when STEP_ID is not a UUID', () => {
    const text = makeBlock(
      [
        'Q: Review',
        'STEP_ID: step-uuid-123',
        'FIELD: rowData',
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )
    expect(parseColumnTableBlock(text)).toBeNull()
  })

  it('returns null when FIELD: is missing', () => {
    const text = makeBlock(
      [
        'Q: Review',
        `STEP_ID: ${STEP_ID}`,
        'ROWS:',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )
    expect(parseColumnTableBlock(text)).toBeNull()
  })

  it('returns null when there are no rows', () => {
    const text = makeBlock(
      ['Q: Review', `STEP_ID: ${STEP_ID}`, 'FIELD: rowData', 'ROWS:'].join(
        '\n',
      ),
    )
    expect(parseColumnTableBlock(text)).toBeNull()
  })

  it('skips a malformed row line rather than throwing', () => {
    const text = makeBlock(
      [
        'Q: Review',
        `STEP_ID: ${STEP_ID}`,
        'FIELD: rowData',
        'ROWS:',
        '- this is not a valid row',
        '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
      ].join('\n'),
    )
    expect(parseColumnTableBlock(text)?.rows).toEqual([
      { id: 'col-a', name: 'Name', draft: 'value', include: true },
    ])
  })

  it('returns null when no COLUMN_TABLE_DATA block is present', () => {
    expect(parseColumnTableBlock('Some normal text')).toBeNull()
  })

  it('only parses COLUMN_TABLE_DATA when a DYNAMIC_PICKER_DATA block is also present', () => {
    const text = [
      '<!-- DYNAMIC_PICKER_DATA',
      'Q: Old question',
      'STEP_ID: step-uuid-456',
      'KEY: listChannels',
      '-->',
      makeBlock(
        [
          'Q: Review',
          `STEP_ID: ${STEP_ID}`,
          'FIELD: rowData',
          'ROWS:',
          '- ID: col-a, NAME: Name, DRAFT: value, INCLUDE: true',
        ].join('\n'),
      ),
    ].join('\n')

    expect(parseColumnTableBlock(text)?.stepId).toBe(STEP_ID)
  })
})
