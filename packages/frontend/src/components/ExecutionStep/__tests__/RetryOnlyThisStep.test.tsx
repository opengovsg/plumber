// @vitest-environment jsdom
import { ThemeProvider } from '@opengovsg/design-system-react'
import type { IExecution, IExecutionStep } from '@plumber/types'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RETRY_SUCCESSFUL_EXECUTION_STEP_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

import ExecutionStep from '../index'

// The design system's Tabs resolve a different Chakra context instance under vitest.
vi.mock('@opengovsg/design-system-react', async (importOriginal) => {
  const chakra = await import('@chakra-ui/react')
  return {
    ...(await importOriginal<
      typeof import('@opengovsg/design-system-react')
    >()),
    Tab: chakra.Tab,
    Tabs: chakra.Tabs,
  }
})
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: () => ({
    loading: false,
    data: { getApp: { key: 'postman', name: 'Email by Postman' } },
  }),
  useMutation: () => [vi.fn()],
}))

const execution = {
  id: 'execution-1',
  status: 'success',
  flow: { id: 'flow-1', role: 'owner' },
} as unknown as IExecution

const executionStep = {
  id: 'execution-step-2',
  appKey: 'postman',
  key: 'sendTransactionalEmail',
  status: 'success',
  dataIn: {},
  dataOut: {},
  errorDetails: null,
  jobId: 'job-1',
} as unknown as IExecutionStep

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(isFlagOn: boolean, index = 1) {
  act(() =>
    root.render(
      <ThemeProvider>
        <LaunchDarklyContext.Provider
          value={{
            error: null,
            getFlagValue: (flagKey, defaultValue) =>
              flagKey === RETRY_SUCCESSFUL_EXECUTION_STEP_FLAG
                ? isFlagOn
                : defaultValue,
          }}
        >
          <ExecutionStep
            index={index}
            page={1}
            execution={execution}
            executionStep={executionStep}
          />
        </LaunchDarklyContext.Provider>
      </ThemeProvider>,
    ),
  )
}

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

describe('Retry this step only', () => {
  it('shows the button with a tooltip when the flag is on', () => {
    render(true)

    expect(document.body.textContent).toContain('Retry this step only')
    expect(document.body.textContent).toContain('Later steps will not run.')
  })

  it('hides the button when the flag is off', () => {
    render(false)

    expect(document.body.textContent).not.toContain('Retry this step only')
  })

  it('hides the button on the trigger', () => {
    render(true, 0)

    expect(document.body.textContent).not.toContain('Retry this step only')
  })
})
