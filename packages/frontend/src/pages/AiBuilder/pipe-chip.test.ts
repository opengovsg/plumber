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
  it('returns null when no pipe was selected', () => {
    expect(
      resolveSubjectName({
        subject: null,
        previewPipeId: PIPE_ID,
        selectionPending: false,
      }),
    ).toBeNull()
  })

  it('returns the name once the preview shows the selected pipe', () => {
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: PIPE_ID,
        selectionPending: false,
      }),
    ).toBe('Leave form')
  })

  it('returns the name while the selection turn is streaming', () => {
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: null,
        selectionPending: true,
      }),
    ).toBe('Leave form')
  })

  it('returns null after the server refused the selection', () => {
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: null,
        selectionPending: false,
      }),
    ).toBeNull()
  })

  it('returns null once the preview moved to a different pipe', () => {
    expect(
      resolveSubjectName({
        subject,
        previewPipeId: OTHER_PIPE_ID,
        selectionPending: false,
      }),
    ).toBeNull()
  })
})

describe('derivePipeChip', () => {
  it('hides the chip once a pipe is selected', () => {
    expect(
      derivePipeChip({ pipeCreated: true, subjectName: 'Leave form', onSelect }),
    ).toEqual({ kind: 'hidden' })
  })

  it('hides the chip when the model created a pipe and nobody selected one', () => {
    expect(
      derivePipeChip({ pipeCreated: true, subjectName: null, onSelect }),
    ).toEqual({ kind: 'hidden' })
  })

  it('offers the picker before any pipe exists', () => {
    expect(
      derivePipeChip({ pipeCreated: false, subjectName: null, onSelect }),
    ).toEqual({ kind: 'pick', onSelect })
  })
})

describe('showComposerChips', () => {
  it('shows the row when form callbacks exist', () => {
    expect(
      showComposerChips({
        formCallbacks: true,
        attachedForm: false,
        pipeChip: { kind: 'hidden' },
      }),
    ).toBe(true)
  })

  it('shows the row for a pipe pick', () => {
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: false,
        pipeChip: { kind: 'pick', onSelect },
      }),
    ).toBe(true)
  })

  it('hides the row when no chip applies', () => {
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: false,
        pipeChip: { kind: 'hidden' },
      }),
    ).toBe(false)
  })
})

describe('pipeHeaderTitle', () => {
  it('uses the selected pipe title ahead of the default name', () => {
    expect(
      pipeHeaderTitle({ flowName: 'Build with AI', subjectName: 'Leave form' }),
    ).toBe('Leave form')
  })

  it('keeps the default name when no pipe is selected', () => {
    expect(
      pipeHeaderTitle({ flowName: 'Build with AI', subjectName: null }),
    ).toBe('Build with AI')
  })
})

describe('showConnectFormChip', () => {
  it('hides the chip once a pipe is selected', () => {
    expect(
      showConnectFormChip({ pipeCreated: false, subjectName: 'Leave form' }),
    ).toBe(false)
  })

  it('hides the chip once a pipe exists', () => {
    expect(showConnectFormChip({ pipeCreated: true, subjectName: null })).toBe(
      false,
    )
  })

  it('shows the chip before any pipe is selected or created', () => {
    expect(showConnectFormChip({ pipeCreated: false, subjectName: null })).toBe(
      true,
    )
  })
})
