// @vitest-environment jsdom
import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import SecretKeyWarningDialog from './SecretKeyWarningDialog'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

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

async function renderDialog(props: {
  isFormsgKey: boolean
  onConnectSecurely?: () => void
}): Promise<void> {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <SecretKeyWarningDialog
          cancelRef={createRef<HTMLButtonElement>()}
          isOpen
          onClose={vi.fn()}
          onSendAnyway={vi.fn()}
          onRemoveKeyAndSend={vi.fn()}
          {...props}
        />
      </ThemeProvider>,
    )
  })
}

function buttonLabels(): string[] {
  return [...document.body.querySelectorAll('button')].map(
    (el) => el.textContent?.trim() ?? '',
  )
}

describe('SecretKeyWarningDialog', () => {
  beforeEach(() => {
    stubMatchMedia()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('does not let a FormSG key be sent to the AI', async () => {
    await renderDialog({ isFormsgKey: true })
    expect(buttonLabels()).not.toContain('Send anyway')
    expect(buttonLabels()).toContain('Remove key and send')
    expect(buttonLabels()).not.toContain('Connect securely')
  })

  it('offers the secure connection once it is available', async () => {
    const onConnectSecurely = vi.fn()
    await renderDialog({ isFormsgKey: true, onConnectSecurely })
    const connect = [...document.body.querySelectorAll('button')].find(
      (el) => el.textContent?.trim() === 'Connect securely',
    )
    await act(async () => {
      connect?.click()
    })
    expect(onConnectSecurely).toHaveBeenCalledTimes(1)
  })

  it('keeps "Send anyway" for keys of other apps', async () => {
    await renderDialog({ isFormsgKey: false })
    expect(buttonLabels()).toContain('Send anyway')
    expect(buttonLabels()).not.toContain('Remove key and send')
  })
})
