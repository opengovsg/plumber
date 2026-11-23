// @vitest-environment jsdom
import { Modal } from '@chakra-ui/react'
import { ThemeProvider } from '@opengovsg/design-system-react'
import type { ContextType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FlowStepConfigurationContext } from '../../FlowStepConfigurationContext'
import ConfigureDatabricksConnection from '../ConfigureDatabricksConnection'

const mocks = vi.hoisted(() => ({
  testConnection: vi.fn(),
}))

vi.mock('@/contexts/Editor', async () => {
  const { createContext } = await import('react')
  return { EditorContext: createContext({ flowId: 'flow-1' }) }
})
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: () => ({
    loading: false,
    data: {
      getApp: {
        connections: [
          { id: 'legacy-id', generation: 'legacy' },
          { id: 'new-id', generation: 'new' },
        ],
      },
    },
  }),
}))
vi.mock('../ConnectionHeader', () => ({ default: () => null }))
vi.mock('@opengovsg/design-system-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opengovsg/design-system-react')>()),
  ModalCloseButton: () => null,
}))
vi.mock('../../hooks/useConnectionRegistration', () => ({
  useConnectionVerification: () => ({
    testResult: undefined,
    testResultLoading: false,
    testConnection: mocks.testConnection,
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
  mocks.testConnection.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function renderWith(selectedConnectionId: string) {
  const context = {
    modalState: { selectedConnectionId },
  } as unknown as ContextType<typeof FlowStepConfigurationContext>
  act(() => {
    root.render(
      <ThemeProvider>
        <Modal isOpen onClose={vi.fn()}>
          <FlowStepConfigurationContext.Provider value={context}>
            <ConfigureDatabricksConnection
              onBack={vi.fn()}
              onCreateOrUpdateStep={vi.fn()}
            />
          </FlowStepConfigurationContext.Provider>
        </Modal>
      </ThemeProvider>,
    )
  })
}

describe('ConfigureDatabricksConnection', () => {
  it('falls back to the new row when no connection is selected', () => {
    renderWith('')

    expect(mocks.testConnection).toHaveBeenCalledWith('new-id')
  })

  it('keeps the selected connection', () => {
    renderWith('legacy-id')

    expect(mocks.testConnection).toHaveBeenCalledWith('legacy-id')
  })
})
