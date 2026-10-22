// Rule: Reconnect is enabled only on the first MRF trigger and disabled on subsequent sub-trigger steps.
// @vitest-environment jsdom
import type { IApp, IFlow, IStep } from '@plumber/types'

import type { ContextType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { ThemeProvider } from '@opengovsg/design-system-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorContext } from '@/contexts/Editor'
import {
  FORMSG_APP_KEY,
  FORMSG_TRIGGER_KEY,
  MRF_ACTION_KEY,
} from '@/helpers/formsg'

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

describe('MRF connection editing', () => {
  it.each([
    {
      label: 'first MRF trigger',
      key: FORMSG_TRIGGER_KEY,
      type: 'trigger',
      position: 1,
      disabled: false,
    },
    {
      label: 'MRF sub-trigger',
      key: MRF_ACTION_KEY,
      type: 'action',
      position: 2,
      disabled: true,
    },
  ] as const)('$label', async ({ key, type, position, disabled }) => {
    const onReconnect = vi.fn()
    const step: IStep = {
      id: `step-${position}`,
      appKey: FORMSG_APP_KEY,
      key,
      type,
      position,
      flowId: 'flow',
      iconUrl: '',
      webhookUrl: '',
      status: 'completed',
      flow: { role: 'owner' } as IFlow,
      executionSteps: [],
      config: {},
      createdAt: '2026-10-22T00:00:00Z',
      parameters: { mrf: {} },
      connection: {
        id: 'connection',
        formattedData: {
          screenName: '654ab1234abc1a012345f1e0 - Leave application',
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
              application={{ key: FORMSG_APP_KEY } as IApp}
              onReconnect={onReconnect}
            />
          </EditorContext.Provider>
        </ThemeProvider>,
      )
    })

    const button = container.querySelector('button')
    expect(button?.textContent).toContain('Reconnect')
    expect(button?.disabled).toBe(disabled)
    act(() => button?.click())
    expect(onReconnect).toHaveBeenCalledTimes(disabled ? 0 : 1)
  })
})
