import { describe, expect, it } from 'vitest'

import { classifyUnresolvedVariables } from '../../auth/helpers/report-unresolved-variables'
import { NricFilter } from '../../triggers/new-submission'

const TRIGGER_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_STEP_ID = '22222222-2222-2222-2222-222222222222'

const ref = (path: string, stepId = TRIGGER_ID) => `{{step.${stepId}.${path}}}`

function classify(
  references: string[],
  overrides: Partial<Parameters<typeof classifyUnresolvedVariables>[0]> = {},
) {
  return classifyUnresolvedVariables({
    triggerStepId: TRIGGER_ID,
    parameters: [JSON.stringify({ body: references.join(' ') })],
    fields: {
      text: { fieldType: 'textfield', question: 'Name', answer: 'Tan' },
    },
    schema: {
      fields: [
        { _id: 'text', fieldType: 'textfield', title: 'Name' },
        { _id: 'missing', fieldType: 'textfield', title: 'Age' },
        { _id: 'nric', fieldType: 'nric', title: 'NRIC' },
        { _id: 'kids', fieldType: 'children', title: 'Children' },
        { _id: 'later', fieldType: 'textfield', title: 'Approval' },
      ],
      restorableIds: new Set(['text', 'missing', 'nric', 'kids']),
    },
    rawVerifiedKeys: [],
    verifiedSubmitterInfo: {},
    nricFilter: NricFilter.None,
    ...overrides,
  }).map(({ cause }) => cause)
}

describe('classifyUnresolvedVariables', () => {
  it.each([
    { name: 'a resolved answer', path: 'fields.text.answer', cause: null },
    {
      name: 'a question removed from the form',
      path: 'fields.gone.answer',
      cause: 'question_deleted',
    },
    {
      name: 'a schema question missing from the output',
      path: 'fields.missing.answer',
      cause: 'unsupported_payload',
    },
    {
      name: 'a field missing the referenced property',
      path: 'fields.text.answerArray',
      cause: 'unsupported_payload',
    },
    {
      name: 'a child index the submission does not have',
      path: 'fields.childrenbirthrecords_kids_childname_1.answer',
      cause: null,
    },
    {
      name: 'a field from an MRF step not reached yet',
      path: 'fields.later.answer',
      cause: null,
    },
  ])('$name: $cause', ({ path, cause }) => {
    expect(classify([ref(path)])).toEqual(cause ? [cause] : [])
  })

  it('flags an answer stringified to "undefined"', () => {
    expect(
      classify([ref('fields.text.answer')], {
        fields: { text: { answer: 'undefined' } },
      }),
    ).toEqual(['unsupported_payload'])
  })

  it('skips an NRIC removed by the NRIC filter', () => {
    expect(
      classify(
        [ref('fields.nric.answer'), ref('verifiedSubmitterInfo.uinFin')],
        {
          nricFilter: NricFilter.Remove,
          rawVerifiedKeys: ['uinFin'],
        },
      ),
    ).toEqual([])
  })

  it.each([
    {
      name: 'FormSG renamed the key',
      raw: ['cpUen (Step 1)'],
      cause: 'unsupported_payload',
    },
    { name: 'the login type changed', raw: ['uinFin'], cause: null },
  ])('verified key missing because $name: $cause', ({ raw, cause }) => {
    expect(
      classify([ref('verifiedSubmitterInfo.cpUen')], { rawVerifiedKeys: raw }),
    ).toEqual(cause ? [cause] : [])
  })

  it('reads references with modifiers and ignores other steps', () => {
    expect(
      classify([
        `{{step.${TRIGGER_ID}.fields.gone.answer|7461626c65}}`,
        ref('fields.gone.answer', OTHER_STEP_ID),
      ]),
    ).toEqual(['question_deleted'])
  })
})
