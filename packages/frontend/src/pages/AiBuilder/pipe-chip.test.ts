import { describe, expect, it, vi } from 'vitest'

import { derivePipeChip, showComposerChips } from './pipe-chip'

const onSelect = vi.fn()

describe('derivePipeChip', () => {
  it('shows the selected name ahead of a recovered name', () => {
    expect(
      derivePipeChip({
        pipeCreated: true,
        selectedName: 'Selected',
        recoveredName: 'Recovered',
        onSelect,
      }),
    ).toEqual({ kind: 'named', name: 'Selected' })
  })

  it('shows the recovered name when this session has not selected one', () => {
    expect(
      derivePipeChip({
        pipeCreated: false,
        selectedName: null,
        recoveredName: 'Recovered',
        onSelect,
      }),
    ).toEqual({ kind: 'named', name: 'Recovered' })
  })

  it('hides the chip when the model created a pipe and nobody selected one', () => {
    expect(
      derivePipeChip({
        pipeCreated: true,
        selectedName: null,
        recoveredName: null,
        onSelect,
      }),
    ).toEqual({ kind: 'hidden' })
  })

  it('offers a pick when the chat has no pipe and no selection', () => {
    expect(
      derivePipeChip({
        pipeCreated: false,
        selectedName: null,
        recoveredName: null,
        onSelect,
      }),
    ).toEqual({ kind: 'pick', onSelect })
  })
})

describe('showComposerChips', () => {
  const hidden = { kind: 'hidden' as const }

  it('shows the row for form callbacks', () => {
    expect(
      showComposerChips({
        formCallbacks: true,
        attachedForm: false,
        pipeChip: hidden,
      }),
    ).toBe(true)
  })

  it('shows the row for an attached form', () => {
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: true,
        pipeChip: hidden,
      }),
    ).toBe(true)
  })

  it('shows the row for a pipe pick or a named pipe', () => {
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
        pipeChip: { kind: 'named', name: 'Leave' },
      }),
    ).toBe(true)
  })

  it('hides the row when no chip applies', () => {
    expect(
      showComposerChips({
        formCallbacks: false,
        attachedForm: false,
        pipeChip: hidden,
      }),
    ).toBe(false)
  })
})
