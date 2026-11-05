import { describe, expect, it, vi } from 'vitest'

import {
  derivePipeChip,
  pipeHeaderTitle,
  showComposerChips,
  showConnectFormChip,
} from './pipe-chip'

const onSelect = vi.fn()

describe('derivePipeChip', () => {
  it('hides the chip once a pipe name is known', () => {
    expect(
      derivePipeChip({
        pipeCreated: true,
        selectedName: 'Selected',
        recoveredName: 'Recovered',
        onSelect,
      }),
    ).toEqual({ kind: 'hidden' })
  })

  it('hides the chip when a previous turn already named the pipe', () => {
    expect(
      derivePipeChip({
        pipeCreated: false,
        selectedName: null,
        recoveredName: 'Recovered',
        onSelect,
      }),
    ).toEqual({ kind: 'hidden' })
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
        pipeChip: hidden,
      }),
    ).toBe(false)
  })
})

describe('pipeHeaderTitle', () => {
  it('uses the selected pipe title ahead of the default name', () => {
    expect(
      pipeHeaderTitle({
        flowName: 'Build with AI',
        selectedName: 'Leave form',
        recoveredName: 'Older pipe',
      }),
    ).toBe('Leave form')
  })

  it('uses a recovered pipe title after refresh', () => {
    expect(
      pipeHeaderTitle({
        flowName: 'Build with AI',
        selectedName: null,
        recoveredName: 'Leave form',
      }),
    ).toBe('Leave form')
  })

  it('keeps the default name when no pipe is selected', () => {
    expect(
      pipeHeaderTitle({
        flowName: 'Build with AI',
        selectedName: null,
        recoveredName: null,
      }),
    ).toBe('Build with AI')
  })
})

describe('showConnectFormChip', () => {
  it('hides the chip once a pipe is selected', () => {
    expect(
      showConnectFormChip({
        pipeCreated: false,
        selectedName: 'Leave form',
        recoveredName: null,
      }),
    ).toBe(false)
  })

  it('hides the chip when a previous turn already named the pipe', () => {
    expect(
      showConnectFormChip({
        pipeCreated: false,
        selectedName: null,
        recoveredName: 'Leave form',
      }),
    ).toBe(false)
  })

  it('hides the chip once a pipe exists', () => {
    expect(
      showConnectFormChip({
        pipeCreated: true,
        selectedName: null,
        recoveredName: null,
      }),
    ).toBe(false)
  })

  it('shows the chip before any pipe is chosen', () => {
    expect(
      showConnectFormChip({
        pipeCreated: false,
        selectedName: null,
        recoveredName: null,
      }),
    ).toBe(true)
  })
})
