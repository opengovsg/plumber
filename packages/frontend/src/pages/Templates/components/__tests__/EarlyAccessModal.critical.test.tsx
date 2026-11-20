// @vitest-environment jsdom
// Business rule: this modal should only show on the first load of the page -
// afterwards, it should never show
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import EarlyAccessModal from '../EarlyAccessModal'

const MODAL_TITLE = 'Try community templates?'

let root: Root | undefined

async function renderModal(): Promise<void> {
  root = createRoot(document.createElement('div'))
  await act(async () => {
    root?.render(
      <ThemeProvider>
        <EarlyAccessModal onTurnOn={vi.fn()} />
      </ThemeProvider>,
    )
  })
}

async function unmountModal(): Promise<void> {
  await act(async () => root?.unmount())
  root = undefined
}

function isModalShown(): boolean {
  return document.body.textContent?.includes(MODAL_TITLE) ?? false
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(async () => {
  await unmountModal()
})

describe('early access modal', () => {
  it('shows on the first load of the page', async () => {
    await renderModal()

    expect(isModalShown()).toBe(true)
  })

  it('never shows on later loads, even if the user did not respond', async () => {
    await renderModal()
    await unmountModal()

    await renderModal()

    expect(isModalShown()).toBe(false)
  })
})
