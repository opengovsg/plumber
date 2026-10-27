// @vitest-environment jsdom
import type { IApp } from '@plumber/types'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import AppRow from '.'

const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"]'

const APPLICATION = {
  key: 'formsg',
  name: 'FormSG',
  iconUrl: '',
  connectionCount: 2,
  flowCount: 3,
} as IApp

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function LocationDisplay() {
  return <div data-test="location">{useLocation().pathname}</div>
}

async function renderRow(): Promise<void> {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<AppRow application={APPLICATION} />} />
            <Route path="*" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )
  })
}

function row(): HTMLAnchorElement {
  return container.querySelector('[data-test="app-row"]') as HTMLAnchorElement
}

function currentPath(): string | undefined {
  return (
    container.querySelector('[data-test="location"]')?.textContent ?? undefined
  )
}

describe('AppRow', () => {
  beforeEach(() => {
    window.matchMedia = (() => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('exposes the row as the only focusable element', async () => {
    await renderRow()

    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('/app/formsg')
    expect(container.querySelectorAll(FOCUSABLE_SELECTOR)).toHaveLength(1)
    expect(container.querySelector('button')).toBeNull()
  })

  it('hides the chevron from assistive technology', async () => {
    await renderRow()

    const chevron = row().querySelector('svg')
    expect(chevron).not.toBeNull()
    expect(chevron?.getAttribute('aria-hidden')).toBe('true')
  })

  it('navigates to the app page when the row is activated', async () => {
    await renderRow()

    await act(async () => row().click())

    expect(currentPath()).toBe('/app/formsg')
  })

  it('navigates to the same destination when the chevron is clicked', async () => {
    await renderRow()

    const chevron = row().querySelector('svg') as SVGElement
    await act(async () => {
      chevron.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      )
    })

    expect(currentPath()).toBe('/app/formsg')
  })
})
