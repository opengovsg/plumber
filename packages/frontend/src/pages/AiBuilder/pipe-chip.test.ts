import { parsePipeId } from '@plumber/shared'
import { describe, expect, it, vi } from 'vitest'

import {
  derivePipeChip,
  pipeHeaderTitle,
  resolveSubjectName,
  showComposerChips,
  showConnectFormChip,
} from './pipe-chip'

const onSelect = vi.fn()
const PIPE_ID = parsePipeId('123e4567-e89b-12d3-a456-426614174000')
const OTHER_PIPE_ID = '223e4567-e89b-12d3-a456-426614174000'
if (!PIPE_ID) {
  throw new Error('fixture is not a pipe id')
}
const subject = { pipeId: PIPE_ID, displayName: 'Leave form' }

describe('resolveSubjectName', () => {
  it('shows the name only while pending or confirmed', () => {
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: PIPE_ID,
        selectionPending: false,
      }),
    ).toBe('Leave form')
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: null,
        selectionPending: true,
      }),
    ).toBe('Leave form')
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: OTHER_PIPE_ID,
        selectionPending: false,
      }),
    ).toBeNull()
    expect(
      resolveSubjectName({
        subject: null,
        previewPipeId: PIPE_ID,
        selectionPending: true,
      }),
    ).toBeNull()
  })
})

describe('derivePipeChip', () => {
  it('hides the chip once a pipe is selected or created', () => {
    expect(
      derivePipeChip({
        pipeCreated: false,
        subjectName: 'Leave form',
        onSelect,
      }),
    ).toEqual({ kind: 'hidden' })
    expect(
      derivePipeChip({ pipeCreated: true, subjectName: null, onSelect }),
    ).toEqual({ kind: 'hidden' })
    expect(
      derivePipeChip({ pipeCreated: false, subjectName: null, onSelect }),
    ).toEqual({ kind: 'pick', onSelect })
  })
})

describe('pipeHeaderTitle', () => {
  it('uses the selected title, otherwise the default name', () => {
    expect(
      pipeHeaderTitle({ flowName: 'Build with AI', subjectName: 'Leave form' }),
    ).toBe('Leave form')
    expect(
      pipeHeaderTitle({ flowName: 'Build with AI', subjectName: null }),
    ).toBe('Build with AI')
  })
})

describe('showConnectFormChip', () => {
  it('shows the chip only before a pipe is selected or created', () => {
    expect(
      showConnectFormChip({ pipeCreated: false, subjectName: null }),
    ).toBe(true)
    expect(
      showConnectFormChip({ pipeCreated: false, subjectName: 'Leave form' }),
    ).toBe(false)
    expect(
      showConnectFormChip({ pipeCreated: true, subjectName: null }),
    ).toBe(false)
  })
})

describe('showComposerChips', () => {
  it('shows the row when any chip applies', () => {
    expect(
      showComposerChips({
        formCallbacks: true,
        attachedForm: false,
        pipeChip: { kind: 'hidden' },
      }),
    ).toBe(true)
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: false,
        pipeChip: { kind: 'pick', onSelect },
      }),
    ).toBe(true)
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: false,
        pipeChip: { kind: 'hidden' },
      }),
    ).toBe(false)
  })
})
