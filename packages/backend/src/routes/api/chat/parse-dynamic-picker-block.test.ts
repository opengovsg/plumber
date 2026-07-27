import { describe, expect, it } from 'vitest'

import { parseDynamicPickerBlock } from './parse-dynamic-picker-block'

const makeBlock = (inner: string) => `<!-- DYNAMIC_PICKER_DATA\n${inner}\n-->`

describe('parseDynamicPickerBlock', () => {
  it('returns correct data for a valid block', () => {
    const text = makeBlock(
      'Q: Which channel?\nSTEP_ID: step-uuid-123\nKEY: listChannels',
    )
    expect(parseDynamicPickerBlock(text)).toEqual({
      question: 'Which channel?',
      stepId: 'step-uuid-123',
      key: 'listChannels',
    })
  })

  it('parses questions containing colons correctly', () => {
    const text = makeBlock(
      'Q: Which channel: main or secondary?\nSTEP_ID: step-uuid-123\nKEY: listChannels',
    )
    expect(parseDynamicPickerBlock(text)).toEqual({
      question: 'Which channel: main or secondary?',
      stepId: 'step-uuid-123',
      key: 'listChannels',
    })
  })

  it('returns null when Q: is missing', () => {
    const text = makeBlock('STEP_ID: step-uuid-123\nKEY: listChannels')
    expect(parseDynamicPickerBlock(text)).toBeNull()
  })

  it('returns null when Q: is empty', () => {
    const text = makeBlock('Q:\nSTEP_ID: step-uuid-123\nKEY: listChannels')
    expect(parseDynamicPickerBlock(text)).toBeNull()
  })

  it('returns null when STEP_ID: is missing', () => {
    const text = makeBlock('Q: Which channel?\nKEY: listChannels')
    expect(parseDynamicPickerBlock(text)).toBeNull()
  })

  it('returns null when KEY: is missing', () => {
    const text = makeBlock('Q: Which channel?\nSTEP_ID: step-uuid-123')
    expect(parseDynamicPickerBlock(text)).toBeNull()
  })

  it('returns null when no DYNAMIC_PICKER_DATA block is present', () => {
    expect(parseDynamicPickerBlock('Some normal text')).toBeNull()
  })

  it('only parses DYNAMIC_PICKER_DATA when both CLARIFICATION_DATA and DYNAMIC_PICKER_DATA are present', () => {
    const text = [
      '<!-- CLARIFICATION_DATA',
      'Q: Old question',
      '- Option 1',
      '-->',
      makeBlock('Q: Dynamic question\nSTEP_ID: step-uuid-456\nKEY: listSheets'),
    ].join('\n')

    expect(parseDynamicPickerBlock(text)).toEqual({
      question: 'Dynamic question',
      stepId: 'step-uuid-456',
      key: 'listSheets',
    })
  })
})
