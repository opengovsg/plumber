// @vitest-environment jsdom
// Rule: The old step drawer reads "Connected to [DEPRECATED] " plus the schema name.
// Rule: A new step drawer has no prefix.
// Rule: The href stays the schema name when the label is prefixed.
import { ThemeProvider } from '@opengovsg/design-system-react'
import type { IApp, IFlow, IStep } from '@plumber/types'
import type { ContextType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorContext } from '@/contexts/Editor'

import { DATABRICKS_APP_KEY } from '../FlowStepConfigurationModal/constants'
import ChooseConnectionSubstep from './index'

vi.mock('@/contexts/Editor', async () => {
  const { createContext } = await import('react')
  return { EditorContext: createContext({}) }
})
vi.mock('@/hooks/useAuthentication', () => ({
  default: () => ({ currentUser: { email: 'owner@example.com' } }),
}))
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: () => ({
    loading: false,
    data: {
      testConnection: {
        connectionVerified: true,
        registrationVerified: true,
      },
    },
  }),
}))

const SCHEMA = 'user_example_com'
const ENV = JSON.stringify({
  hostname: 'example.cloud.databricks.com',
  catalog: 'main',
})
const EXPLORE_HREF =
  'https://example.cloud.databricks.com/explore/data/main/user_example_com'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function renderDrawer(generation?: 'legacy' | 'new') {
  const step: IStep = {
    id: 'step-1',
    appKey: DATABRICKS_APP_KEY,
    key: 'run-sql',
    type: 'action',
    position: 1,
    flowId: 'flow',
    iconUrl: '',
    webhookUrl: '',
    status: 'completed',
    flow: { role: 'owner' } as IFlow,
    executionSteps: [],
    config: {},
    createdAt: '2026-10-22T00:00:00Z',
    parameters: {},
    connection: {
      id: 'connection',
      ...(generation ? { generation } : {}),
      formattedData: {
        screenName: SCHEMA,
        env: ENV,
      },
    },
  }

  await act(async () => {
    root.render(
      <ThemeProvider>
        <EditorContext.Provider
          value={
            {
              readOnly: false,
              flow: { role: 'owner' } as IFlow,
            } as ContextType<typeof EditorContext>
          }
        >
          <ChooseConnectionSubstep
            step={step}
            application={{ key: DATABRICKS_APP_KEY } as IApp}
            onReconnect={vi.fn()}
          />
        </EditorContext.Provider>
      </ThemeProvider>,
    )
  })
}

describe('Databricks step drawer', () => {
  it.each([
    {
      label: 'legacy',
      generation: 'legacy' as const,
      text: `Connected to [DEPRECATED] ${SCHEMA}`,
    },
    {
      label: 'missing generation',
      generation: undefined,
      text: `Connected to [DEPRECATED] ${SCHEMA}`,
    },
    {
      label: 'new',
      generation: 'new' as const,
      text: `Connected to ${SCHEMA}`,
    },
  ])('$label', async ({ generation, text }) => {
    await renderDrawer(generation)

    expect(container.textContent).toContain(text)
    if (generation !== 'new') {
      expect(container.textContent).toContain(`[DEPRECATED] ${SCHEMA}`)
    } else {
      expect(container.textContent).not.toContain('[DEPRECATED]')
    }
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      EXPLORE_HREF,
    )
    expect(container.querySelector('a')?.getAttribute('href')).not.toContain(
      'DEPRECATED',
    )
  })
})
