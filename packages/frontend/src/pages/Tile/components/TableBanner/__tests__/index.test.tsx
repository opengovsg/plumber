// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import TableBanner from '..'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const mocks = vi.hoisted(() => ({
  context: { tableName: 'Tile', role: 'editor', isMigrating: true },
}))

vi.mock('../../../contexts/TableContext', () => ({
  useTableContext: () => mocks.context,
}))
vi.mock('../BreadCrumb', () => ({ default: () => null }))
vi.mock('../EditMode', () => ({ default: () => null }))
vi.mock('../ImportExportToolbar', () => ({ default: () => null }))
vi.mock('../RefreshButton', () => ({ default: () => null }))

const BANNER_TEXT = 'This tile is being upgraded.'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(role: string | undefined, isMigrating: boolean): string {
  mocks.context = { tableName: 'Tile', role: role as string, isMigrating }
  act(() => {
    root.render(
      <ThemeProvider>
        <TableBanner />
      </ThemeProvider>,
    )
  })
  return container.textContent ?? ''
}

describe('TableBanner migrating infobox', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it.each(['editor', 'owner'])('shows for %s while migrating', (role) => {
    expect(render(role, true)).toContain(BANNER_TEXT)
  })

  it.each([
    ['viewer', true],
    [undefined, true],
    ['editor', false],
  ])('hides for role %s with isMigrating %s', (role, isMigrating) => {
    expect(render(role, isMigrating)).not.toContain(BANNER_TEXT)
  })
})
