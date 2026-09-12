import { describe, expect, it } from 'vitest'

import type { VariableInfoMap } from '../RichTextEditor/utils'

import { matchParamsToDataIn } from './utils'

const CHECKBOX_VAR =
  '{{step.11111111-1111-1111-1111-111111111111.answers.cats}}'

function buildVarInfoMap(entries: Array<[string, string]>): VariableInfoMap {
  return new Map(
    entries.map(([key, testRunValue]) => [key, { label: key, testRunValue }]),
  )
}

describe('matchParamsToDataIn', () => {
  it('matches GatherSG checkbox case fields when dataIn has the resolved array', () => {
    const varInfoMap = buildVarInfoMap([[CHECKBOX_VAR, 'Housing, Finance']])

    const params = {
      caseUuid: 'abc123abc123abc123abcd',
      caseFields: [
        {
          field: 'categories',
          fieldType: 'checkbox',
          value: CHECKBOX_VAR,
        },
      ],
    }

    const dataIn = {
      caseUuid: 'abc123abc123abc123abcd',
      caseFields: [
        {
          field: 'categories',
          fieldType: 'checkbox',
          value: ['Housing', 'Finance'],
        },
      ],
    }

    expect(matchParamsToDataIn(dataIn, params, varInfoMap)).toBe(true)
  })

  it('fails GatherSG checkbox case fields when the resolved array differs', () => {
    const varInfoMap = buildVarInfoMap([[CHECKBOX_VAR, 'Housing, Finance']])

    const params = {
      caseFields: [
        {
          field: 'categories',
          fieldType: 'checkbox',
          value: CHECKBOX_VAR,
        },
      ],
    }

    const dataIn = {
      caseFields: [
        {
          field: 'categories',
          fieldType: 'checkbox',
          value: ['Housing'],
        },
      ],
    }

    expect(matchParamsToDataIn(dataIn, params, varInfoMap)).toBe(false)
  })

  it('still matches for-each FormSG checkbox items at the top level', () => {
    const varInfoMap = buildVarInfoMap([[CHECKBOX_VAR, 'A, B']])

    expect(
      matchParamsToDataIn(
        { items: ['A', 'B'] },
        { items: CHECKBOX_VAR },
        varInfoMap,
      ),
    ).toBe(true)
  })

  it('matches plain string params against string dataIn after substitution', () => {
    const textVar = '{{step.11111111-1111-1111-1111-111111111111.answers.name}}'
    const varInfoMap = buildVarInfoMap([[textVar, 'Ada']])

    expect(
      matchParamsToDataIn({ name: 'Ada' }, { name: textVar }, varInfoMap),
    ).toBe(true)
  })
})
