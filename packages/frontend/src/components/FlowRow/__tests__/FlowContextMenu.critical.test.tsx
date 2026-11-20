// @vitest-environment jsdom
// Business rule: "Convert to template" should only be shown to PlumPros.
import type { IFlow } from '@plumber/types'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ isPlumPro: false }))
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useMutation: () => [vi.fn(), { loading: false }],
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/hooks/useIsPlumPro', () => ({ default: () => mocks.isPlumPro }))

import ThemeProvider from '@/components/ThemeProvider'

import FlowContextMenu from '../FlowContextMenu'

const flow = { id: 'flow-id', name: 'Pipe', role: 'owner' } as IFlow
let root: Root | undefined
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

async function openMenu(): Promise<string[]> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() =>
    root?.render(
      <ThemeProvider>
        <FlowContextMenu flow={flow} />
      </ThemeProvider>,
    ),
  )
  const menuButton = document.querySelector(
    '[aria-label="Flow Row Menu Options"]',
  ) as HTMLButtonElement
  menuButton.click()
  await tick()
  return Array.from(document.querySelectorAll('[role="menuitem"]')).map(
    (item) => item.textContent ?? '',
  )
}

afterEach(() => {
  root?.unmount()
  root = undefined
  document.body.innerHTML = ''
})

describe('flow context menu', () => {
  it('shows "Convert to template" to PlumPros', async () => {
    mocks.isPlumPro = true

    expect(await openMenu()).toContain('Convert to template')
  })

  it('hides "Convert to template" from users who are not PlumPros', async () => {
    mocks.isPlumPro = false

    const items = await openMenu()

    expect(items).toContain('Duplicate')
    expect(items).not.toContain('Convert to template')
  })
})
