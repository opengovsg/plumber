import { describe, expect, it } from 'vitest'

import { type CheckboxVariable } from './components/Checkbox'
import { validateFiles } from './utils'

const makeFile = (name: string): CheckboxVariable => ({
  name,
  value: name,
  label: name,
  displayedValue: name,
  type: 'file',
  order: 1,
  isCollapsedByDefault: false,
  size: 100,
})

describe('validateFiles', () => {
  const newFile = makeFile('step.newStep.attachment')
  const availableOptions = [newFile]

  it('allows selecting a file when current selection is empty', () => {
    const result = validateFiles(newFile, availableOptions, [], 1)
    expect(result.isValid).toBe(true)
  })

  it('blocks selecting a file when maxFiles is already reached with valid current selections', () => {
    const existing = makeFile('step.existingStep.attachment')
    const result = validateFiles(
      newFile,
      [existing, newFile],
      [`{{${existing.name}}}`],
      1,
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('1')
  })

  it('blocks selecting a file when stale (out-of-options) values occupy the maxFiles limit', () => {
    // Simulates the pre-fix bug: user changed the upstream form, stale variable remains
    // in raw form values but is absent from current options. validateFiles was called with
    // the raw values, causing a false "max files exceeded" error.
    const staleValue = '{{step.oldStep.oldAttachment}}'
    const result = validateFiles(newFile, availableOptions, [staleValue], 1)
    // This assertion documents that passing raw (stale) values to validateFiles
    // incorrectly blocks the selection — the fix passes filtered currentValues instead.
    expect(result.isValid).toBe(false)
  })
})
