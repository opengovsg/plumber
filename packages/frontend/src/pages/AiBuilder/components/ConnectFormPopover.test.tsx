// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import ConnectFormPopover from './ConnectFormPopover'

const WORKSHOP_LABEL = '654ab1234abc1a012345f1e0 - Workshop Registration'
const LEAVE_LABEL = '654ab1234abc1a012345f1e1 - Leave Application'
const WORKSHOP_ID = 'conn-workshop'
const LEAVE_ID = 'conn-leave'

const CONNECTIONS = [
  { name: WORKSHOP_LABEL, value: WORKSHOP_ID },
  { name: LEAVE_LABEL, value: LEAVE_ID },
]

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let onSelectExisting: ReturnType<typeof vi.fn>
let onAddNewForm: ReturnType<typeof vi.fn>

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

async function waitFor(predicate: () => boolean, attempts = 80): Promise<void> {
  for (let i = 0; i < attempts && !predicate(); i++) {
    await flushMacrotask()
  }
  expect(predicate()).toBe(true)
}

function stubMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

async function renderPopover(): Promise<void> {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <ConnectFormPopover
          isStreaming={false}
          onSelectExisting={onSelectExisting}
          onAddNewForm={onAddNewForm}
        />
      </ThemeProvider>,
    )
  })
}

async function openPopover(): Promise<void> {
  const trigger = document.body.querySelector(
    'button',
  ) as HTMLButtonElement | null
  expect(trigger?.textContent).toContain('Connect your form')
  await act(async () => {
    trigger?.click()
  })
  await waitFor(() => document.body.querySelector('input') !== null)
}

function searchInput(): HTMLInputElement {
  return document.body.querySelector('input') as HTMLInputElement
}

async function typeSearch(value: string): Promise<void> {
  const input = searchInput()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function optionLabels(): string[] {
  return [...document.body.querySelectorAll('button')]
    .map((el) => el.textContent?.trim() ?? '')
    .filter(
      (text) =>
        text !== 'Connect your form' &&
        text !== 'Add a new form' &&
        text.length > 0,
    )
}

describe('ConnectFormPopover search', () => {
  beforeEach(() => {
    stubMatchMedia()
    onSelectExisting = vi.fn()
    onAddNewForm = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: CONNECTIONS }),
      }),
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    vi.unstubAllGlobals()
  })

  it('filters form names case-insensitively and ignores the form-id prefix', async () => {
    await renderPopover()
    await openPopover()

    await typeSearch('workshop')
    expect(optionLabels()).toEqual(['Workshop Registration'])

    await typeSearch('LEAVE')
    expect(optionLabels()).toEqual(['Leave Application'])

    await typeSearch('654ab1234abc1a012345f1e0')
    expect(document.body.textContent).toContain('No matching forms')
    expect(optionLabels()).toEqual([])
  })

  it('shows an empty-state message when no form names match', async () => {
    await renderPopover()
    await openPopover()

    await typeSearch('zzz-not-a-form')
    expect(document.body.textContent).toContain('No matching forms')
    expect(optionLabels()).toEqual([])
    expect(document.body.textContent).toContain('Add a new form')
  })

  it('keeps the connection identifier when selecting a filtered option', async () => {
    await renderPopover()
    await openPopover()

    await typeSearch('workshop')
    const matching = [...document.body.querySelectorAll('button')].find(
      (el) => el.textContent?.trim() === 'Workshop Registration',
    )
    expect(matching).toBeTruthy()

    await act(async () => {
      matching?.click()
    })

    expect(onSelectExisting).toHaveBeenCalledTimes(1)
    expect(onSelectExisting).toHaveBeenCalledWith(WORKSHOP_LABEL, WORKSHOP_ID)
  })

  it('clears the search query when the popover closes and when it opens again', async () => {
    await renderPopover()
    await openPopover()

    await typeSearch('workshop')
    expect(searchInput().value).toBe('workshop')
    expect(optionLabels()).toEqual(['Workshop Registration'])

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    await waitFor(() => document.body.querySelector('input') === null)

    await openPopover()
    expect(searchInput().value).toBe('')
    expect(optionLabels()).toEqual([
      'Workshop Registration',
      'Leave Application',
    ])
  })
})
