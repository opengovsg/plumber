import type { MockedResponse } from '@apollo/client/testing'
import { MockedProvider } from '@apollo/client/testing'
// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import EditorLayout from '@/components/EditorLayout'
import EditorSettingsLayout from '@/components/EditorSettings'
import ThemeProvider from '@/components/ThemeProvider'
import { NOT_FOUND } from '@/config/errors'
import { AuthenticationProvider } from '@/contexts/Authentication'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'
import {
  GET_FLOW,
  GET_FLOW_WITH_COLLABORATORS,
} from '@/graphql/queries/get-flow'

// lottie-web touches canvas and streamdown imports raw CSS at load. Neither works in jsdom.
vi.mock('@/components/NewsDrawer/LottieWebAnimation', () => ({
  default: () => null,
}))
vi.mock('streamdown', () => ({ Streamdown: () => null }))

const FLOW_ID = '00000000-0000-0000-0000-000000000000'
const NOT_FOUND_COPY = 'Pipe not found.'

const loggedInMock: MockedResponse = {
  request: { query: GET_CURRENT_USER },
  result: {
    data: {
      getCurrentUser: {
        id: 'user-1',
        email: 'officer@open.gov.sg',
        createdAt: '1700000000000',
        updatedAt: '1700000000000',
      },
    },
  },
}

// Mirrors the ServerError that HttpLink raises for the backend's HTTP 404 NotFoundError.
function notFoundServerError(): Error {
  return Object.assign(
    new Error('Response not successful: Received status code 404'),
    {
      name: 'ServerError',
      statusCode: 404,
      result: { errors: [{ message: 'Pipe not found.', code: NOT_FOUND }] },
    },
  )
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

async function renderAt(
  path: string,
  routePath: string,
  element: JSX.Element,
  mocks: readonly MockedResponse[],
): Promise<void> {
  root.render(
    <ThemeProvider>
      <MockedProvider mocks={[...mocks]} addTypename={false}>
        <AuthenticationProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={routePath} element={element} />
            </Routes>
          </MemoryRouter>
        </AuthenticationProvider>
      </MockedProvider>
    </ThemeProvider>,
  )

  for (
    let i = 0;
    i < 100 && !container.textContent?.includes(NOT_FOUND_COPY);
    i++
  ) {
    await flushMacrotask()
  }
}

describe('editor pipe not found page', () => {
  beforeEach(() => {
    // Chakra's color mode and media query hooks need it, jsdom has no stub.
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

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it('renders on the editor when getFlow returns a 404 NOT_FOUND', async () => {
    await renderAt(`/editor/${FLOW_ID}`, '/editor/:flowId', <EditorLayout />, [
      loggedInMock,
      {
        request: { query: GET_FLOW, variables: { id: FLOW_ID } },
        error: notFoundServerError(),
      },
    ])

    expect(container.textContent).toContain(NOT_FOUND_COPY)
  })

  it('renders on editor settings when getFlow returns a 404 NOT_FOUND', async () => {
    await renderAt(
      `/editor/${FLOW_ID}/share`,
      '/editor/:flowId/share',
      <EditorSettingsLayout>
        <div />
      </EditorSettingsLayout>,
      [
        loggedInMock,
        {
          request: {
            query: GET_FLOW_WITH_COLLABORATORS,
            variables: { id: FLOW_ID },
          },
          error: notFoundServerError(),
        },
      ],
    )

    expect(container.textContent).toContain(NOT_FOUND_COPY)
  })
})
