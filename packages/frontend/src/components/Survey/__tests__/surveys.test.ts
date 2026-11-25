import { describe, expect, it } from 'vitest'

import { parseApiTimestamp, surveyMetadata } from '../surveys'

describe('parseApiTimestamp', () => {
  it('parses epoch milliseconds from the API', () => {
    expect(parseApiTimestamp('1730000000000')).toEqual(new Date(1730000000000))
  })

  it('parses an ISO string', () => {
    expect(parseApiTimestamp('2026-06-01T00:00:00.000Z')).toEqual(
      new Date('2026-06-01T00:00:00.000Z'),
    )
  })

  it.each([undefined, null, '', 'not a date'])(
    'returns null for %s',
    (value) => {
      expect(parseApiTimestamp(value)).toBeNull()
    },
  )
})

describe('surveyMetadata', () => {
  it('sends the pipe id when the SEQ has one', () => {
    expect(
      surveyMetadata({
        type: 'SEQ',
        flow: 'pipe',
        trigger: 'completion',
        pipeId: 'pipe-1',
      }),
    ).toEqual({
      survey_type: 'seq',
      seq_source: 'pipe',
      seq_trigger: 'completion',
      pipe_id: 'pipe-1',
    })
  })

  it('omits the pipe id when there is none', () => {
    expect(
      surveyMetadata({ type: 'SEQ', flow: 'aiBuilder', trigger: 'abandon' }),
    ).not.toHaveProperty('pipe_id')
  })
})
