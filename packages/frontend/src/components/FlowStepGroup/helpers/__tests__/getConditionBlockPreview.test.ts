import type { IJSONObject } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import {
  type ConditionPreviewPart,
  getConditionBlockPreviewParts,
  getForEachBlockPreviewParts,
} from '../getConditionBlockPreview'

const STEP_ID = '0191b4ee-1a2b-4c3d-8e9f-a1b2c3d4e5f6'
const OTHER_STEP_ID = '0191b4ee-1a2b-4c3d-8e9f-000000000000'

const variable = (path: string) => `{{step.${STEP_ID}.${path}}}`

const conditions = (rows: Array<Record<string, unknown>>[]): IJSONObject =>
  ({
    conditions: rows.map((groupRows) => ({ rows: groupRows })),
  } as unknown as IJSONObject)

/** Renders the parts the way the header does, for readable assertions. */
const asText = (parts: ConditionPreviewPart[]): string =>
  parts
    .map((part) => (part.type === 'variable' ? part.label : part.text))
    .join('')

const typesOf = (parts: ConditionPreviewPart[]): string[] =>
  parts.map((part) => part.type)

describe('getConditionBlockPreviewParts', () => {
  it('falls back to a prompt when there are no conditions', () => {
    expect(getConditionBlockPreviewParts(undefined)).toEqual([
      { type: 'text', text: 'Specify condition' },
    ])
    expect(getConditionBlockPreviewParts({} as IJSONObject)).toEqual([
      { type: 'text', text: 'Specify condition' },
    ])
    expect(
      getConditionBlockPreviewParts({
        conditions: [],
      } as unknown as IJSONObject),
    ).toEqual([{ type: 'text', text: 'Specify condition' }])
  })

  it('falls back to a prompt when every row is still blank', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([[{ field: '', condition: '', text: '' }]]),
        ),
      ),
    ).toBe('Specify condition')
  })

  it('maps an operator key to its plain-language phrase', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [{ field: variable('Age'), condition: 'gte', text: '21' }],
          ]),
        ),
      ),
    ).toBe('Age is greater than or equal to 21')
  })

  it('renders "is not" for a negated row', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [
              {
                field: variable('Status'),
                is: 'not',
                condition: 'equals',
                text: 'Rejected',
              },
            ],
          ]),
        ),
      ).trim(),
    ).toBe('Status is not equal to Rejected')
  })

  it('omits the comparison value for the empty operator', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [{ field: variable('Email'), condition: 'empty', text: 'ignored' }],
          ]),
        ),
      ).trim(),
    ).toBe('Email is empty')
  })

  it('negates each operator with its own verb phrase, not a blanket "is not"', () => {
    const preview = (condition: string, negated: boolean) =>
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [
              {
                field: variable('Subject'),
                is: negated ? 'not' : 'and',
                condition,
                text: 'x',
              },
            ],
          ]),
        ),
      )

    expect(preview('contains', false)).toBe('Subject contains x')
    expect(preview('contains', true)).toBe('Subject does not contain x')
    expect(preview('begins', false)).toBe('Subject begins with x')
    expect(preview('begins', true)).toBe('Subject does not begin with x')
    expect(preview('equals', true)).toBe('Subject is not equal to x')
    expect(preview('after', true)).toBe('Subject is not after x')
  })

  it('falls back to the raw operator key when it has no phrase', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [{ field: variable('Score'), condition: 'weird', text: '3' }],
          ]),
        ),
      ),
    ).toBe('Score is weird 3')

    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [
              {
                field: variable('Score'),
                is: 'not',
                condition: 'weird',
                text: '3',
              },
            ],
          ]),
        ),
      ),
    ).toBe('Score is not weird 3')
  })

  it('splits a step variable out as its own part, labelled by last segment', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: variable('Responses.Email address'),
            condition: 'equals',
            text: 'a@b.gov.sg',
          },
        ],
      ]),
    )

    expect(parts[0]).toEqual({
      type: 'variable',
      id: `step.${STEP_ID}.Responses.Email address`,
      label: 'Email address',
      position: 'leading',
    })
  })

  it('drops a variable pipe modifier from the lookup id', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: `{{step.${STEP_ID}.Amount|currency}}`,
            condition: 'gt',
            text: '0',
          },
        ],
      ]),
    )

    expect(parts[0]).toEqual({
      type: 'variable',
      id: `step.${STEP_ID}.Amount`,
      label: 'Amount',
      position: 'leading',
    })
  })

  it('keeps literal text around a variable', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: variable('Name'),
            condition: 'contains',
            text: `Hi ${variable('Nickname')} !`,
          },
        ],
      ]),
    )

    expect(asText(parts)).toBe('Name contains Hi Nickname !')
    expect(parts.filter((part) => part.type === 'variable')).toHaveLength(2)
  })

  it('handles several variables in one value', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: `{{step.${STEP_ID}.First}} {{step.${OTHER_STEP_ID}.Last}}`,
            condition: 'equals',
            text: 'x',
          },
        ],
      ]),
    )

    expect(
      parts
        .filter(
          (part): part is Extract<ConditionPreviewPart, { type: 'variable' }> =>
            part.type === 'variable',
        )
        .map((part) => part.label),
    ).toEqual(['First', 'Last'])
  })

  it('treats a plain (non-variable) value as text', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([[{ field: 'Age', condition: 'lt', text: '18' }]]),
        ),
      ),
    ).toBe('Age is less than 18')
  })

  it('stringifies numeric and boolean parameter values', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([[{ field: 42, condition: 'equals', text: true }]]),
        ),
      ),
    ).toBe('42 is equal to true')
  })

  it('previews the first non-empty row, skipping blank rows and groups', () => {
    expect(
      asText(
        getConditionBlockPreviewParts(
          conditions([
            [{ field: '', condition: '', text: '' }],
            [
              { field: '', condition: '', text: '' },
              { field: variable('Second'), condition: 'equals', text: 'yes' },
              { field: variable('Third'), condition: 'equals', text: 'no' },
            ],
          ]),
        ),
      ),
    ).toBe('Second is equal to yes')
  })

  it('tolerates a group with no rows array', () => {
    expect(
      asText(
        getConditionBlockPreviewParts({
          conditions: [{}],
        } as unknown as IJSONObject),
      ),
    ).toBe('Specify condition')
  })

  it('marks typed values as literals and the operator as a connective', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: variable('Amount'),
            condition: 'gte',
            text: 'Finance & Corporate Services Division',
          },
        ],
      ]),
    )

    expect(typesOf(parts)).toEqual(['variable', 'text', 'text', 'literal'])
    // The operator phrase is a `text` part so the header leaves it intact; the
    // typed value is a `literal` so the header may truncate it.
    expect(parts.find((part) => part.type === 'text')).toEqual({
      type: 'text',
      text: ' is greater than or equal to',
    })
  })

  it('keeps literal runs around a variable as literals', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: 'Name',
            condition: 'contains',
            text: `Hi ${variable('Nickname')} !`,
          },
        ],
      ]),
    )

    expect(typesOf(parts)).toEqual([
      'literal',
      'text',
      'text',
      'literal',
      'variable',
      'literal',
    ])
  })

  it('marks the placeholder as a connective so it is never truncated', () => {
    expect(typesOf(getConditionBlockPreviewParts(undefined))).toEqual(['text'])
  })

  it('marks where in the sentence each part sits', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([
        [
          {
            field: variable('Name'),
            condition: 'equals',
            text: `Hi ${variable('Nickname')}`,
          },
        ],
      ]),
    )

    const positions = parts
      .filter(
        (
          part,
        ): part is Extract<
          ConditionPreviewPart,
          { type: 'variable' | 'literal' }
        > => part.type === 'variable' || part.type === 'literal',
      )
      .map((part) => part.position)

    // field variable, then the value's literal prefix and its variable
    expect(positions).toEqual(['leading', 'trailing', 'trailing'])
  })

  it('marks a typed field leading and a typed value trailing', () => {
    const parts = getConditionBlockPreviewParts(
      conditions([[{ field: 'Age', condition: 'lt', text: '18' }]]),
    )

    expect(parts).toEqual([
      { type: 'literal', text: 'Age', position: 'leading' },
      { type: 'text', text: ' is less than' },
      { type: 'text', text: ' ' },
      { type: 'literal', text: '18', position: 'trailing' },
    ])
  })
})

describe('getForEachBlockPreviewParts', () => {
  it('falls back to a prompt when no list is set', () => {
    const prompt = [{ type: 'text', text: 'Specify list' }]

    expect(getForEachBlockPreviewParts(undefined)).toEqual(prompt)
    expect(getForEachBlockPreviewParts({} as IJSONObject)).toEqual(prompt)
    expect(
      getForEachBlockPreviewParts({ items: '   ' } as unknown as IJSONObject),
    ).toEqual(prompt)
    expect(
      getForEachBlockPreviewParts({ items: 12 } as unknown as IJSONObject),
    ).toEqual(prompt)
  })

  it('reads as a sentence with "item" and the list name emphasised', () => {
    const parts = getForEachBlockPreviewParts({
      items: variable('Rows'),
    } as unknown as IJSONObject)

    expect(asText(parts)).toBe('For every item in Rows')
    expect(parts).toEqual([
      { type: 'text', text: 'For every ' },
      { type: 'emphasis', text: 'item' },
      { type: 'text', text: ' in ' },
      {
        type: 'variable',
        id: `step.${STEP_ID}.Rows`,
        label: 'Rows',
        position: 'trailing',
      },
    ])
  })

  it('accepts a plain list name', () => {
    expect(
      asText(
        getForEachBlockPreviewParts({
          items: 'my rows',
        } as unknown as IJSONObject),
      ),
    ).toBe('For every item in my rows')
  })
})
