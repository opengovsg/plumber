import { describe, expect, it } from 'vitest'

import { parseClarificationBlock } from './parse-clarification-block'

describe('parseClarificationBlock', () => {
  it('returns null when no block is present', () => {
    expect(parseClarificationBlock('Just some conversational text.')).toBeNull()
  })

  it('returns null for an empty block', () => {
    expect(parseClarificationBlock('<!-- CLARIFICATION_DATA\n-->')).toBeNull()
  })

  it('ignores a Q line with no question text', () => {
    const text = `<!-- CLARIFICATION_DATA\nQ:\n- A\n- B\n-->`.trim()
    expect(parseClarificationBlock(text)).toBeNull()
  })

  it('returns null when a question has fewer than 2 options', () => {
    const text = `
Some response.
<!-- CLARIFICATION_DATA
Q: What trigger?
- Form submission
-->
    `.trim()
    expect(parseClarificationBlock(text)).toBeNull()
  })

  it('parses a single question with 2 options', () => {
    const text = `
Understanding of workflow: ...

<!-- CLARIFICATION_DATA
Q: What kind of notifications do you want to send?
- Email notifications
- Slack messages
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'What kind of notifications do you want to send?',
        options: ['Email notifications', 'Slack messages'],
      },
    ])
  })

  it('parses a single question with 3 options', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: Where should data be stored?
- Tiles
- M365 Excel
- Both
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'Where should data be stored?',
        options: ['Tiles', 'M365 Excel', 'Both'],
      },
    ])
  })

  it('parses multiple questions', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger?
- Form submission
- Scheduled
Q: Where to store?
- Tiles
- M365 Excel
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      { question: 'What trigger?', options: ['Form submission', 'Scheduled'] },
      { question: 'Where to store?', options: ['Tiles', 'M365 Excel'] },
    ])
  })

  it('appends a wrapped option line to the preceding option, mid-list', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger?
- FormSG
- a new trigger
that runs to the next line
- Webhook
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'What trigger?',
        options: [
          'FormSG',
          'a new trigger that runs to the next line',
          'Webhook',
        ],
      },
    ])
  })

  it('appends a continuation line to the last option', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger?
- Form submission
- Scheduled
continuation of scheduled
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'What trigger?',
        options: ['Form submission', 'Scheduled continuation of scheduled'],
      },
    ])
  })

  it('appends wrapped question lines to the question text', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger? For example, the
continuation of the question
- FormSG
- Webhook
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'What trigger? For example, the continuation of the question',
        options: ['FormSG', 'Webhook'],
      },
    ])
  })

  it('appends a hyphenated continuation line to the question rather than treating it as an option', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger? For example, the postman
-transactional-email action is usually used with FormSG Trigger
- FormSG
- Webhook
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question:
          'What trigger? For example, the postman -transactional-email action is usually used with FormSG Trigger',
        options: ['FormSG', 'Webhook'],
      },
    ])
  })

  it('does not bleed a wrapped option into the next question at a Q boundary', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger?
- Form submission
- Scheduled
continuation of scheduled
Q: Where to store?
- Tiles
- M365 Excel
-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      {
        question: 'What trigger?',
        options: ['Form submission', 'Scheduled continuation of scheduled'],
      },
      { question: 'Where to store?', options: ['Tiles', 'M365 Excel'] },
    ])
  })

  it('handles surrounding whitespace in the block', () => {
    const text = `
<!--  CLARIFICATION_DATA

Q:  What trigger?
  -  Form submission
  -  Scheduled

-->
    `.trim()
    expect(parseClarificationBlock(text)).toEqual([
      { question: 'What trigger?', options: ['Form submission', 'Scheduled'] },
    ])
  })

  it('returns null when block is present but all questions have < 2 options', () => {
    const text = `
<!-- CLARIFICATION_DATA
Q: What trigger?
- Form submission
-->
    `.trim()
    expect(parseClarificationBlock(text)).toBeNull()
  })
})
