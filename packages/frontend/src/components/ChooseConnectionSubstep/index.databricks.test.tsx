// @vitest-environment jsdom
import { ThemeProvider } from '@opengovsg/design-system-react'
import type { IApp, IFlow, IJSONObject, IStep } from '@plumber/types'
import type { ContextType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorContext } from '@/contexts/Editor'

import { DATABRICKS_APP_KEY } from '../FlowStepConfigurationModal/constants'
import ChooseConnectionSubstep from './index'

const { SCREEN_NAME, DROPDOWN_LABEL, CONNECTION_ENV } = vi.hoisted(() => {
  const screenName = 'user_example_com'
  return {
    SCREEN_NAME: screenName,
    DROPDOWN_LABEL: `[DEPRECATED] ${screenName}`,
    CONNECTION_ENV: JSON.stringify({
      hostname: 'example.cloud.databricks.com',
      catalog: 'main',
    }),
  }
})

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
vi.mock('../FlowStepConfigurationModal/ChooseAndAddConnection', () => ({
  optionGenerator: () => ({
    label: DROPDOWN_LABEL,
    env: CONNECTION_ENV,
  }),
}))

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

function connectedSentence(): string {
  const paragraph = container.querySelector('p')
  if (!paragraph) {
    return ''
  }
  const copy = paragraph.cloneNode(true) as HTMLElement
  copy.querySelectorAll('a').forEach((anchor) => {
    anchor.remove()
  })
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function renderDrawer(formattedData: IJSONObject): Promise<void> {
  const step: IStep = {
    id: 'step-1',
    appKey: DATABRICKS_APP_KEY,
    key: DATABRICKS_APP_KEY,
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
      formattedData,
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

describe('databricks explore link', () => {
  it('keeps a deprecated dropdown label out of the href', async () => {
    await renderDrawer({ screenName: SCREEN_NAME })

    const anchor = container.querySelector('a')
    const href = anchor?.getAttribute('href') ?? ''

    expect(anchor).not.toBeNull()
    expect(href.endsWith(SCREEN_NAME)).toBe(true)
    expect(href.includes('DEPRECATED')).toBe(false)
    expect(connectedSentence()).toBe(`Connected to ${DROPDOWN_LABEL}`)
  })

  it.each([
    {
      name: 'screenName is omitted',
      formattedData: {},
    },
    {
      name: 'screenName is not a string',
      formattedData: { screenName: 1 },
    },
  ])('renders no explore link when $name', async ({ formattedData }) => {
    await renderDrawer(formattedData)

    expect(container.querySelector('a')).toBeNull()
    expect(connectedSentence()).toBe(`Connected to ${DROPDOWN_LABEL}`)
  })
})
