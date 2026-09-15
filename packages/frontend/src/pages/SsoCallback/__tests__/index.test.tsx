// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { MockedResponse } from '@apollo/client/testing'
import { MockedProvider } from '@apollo/client/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import PublicLayout from '@/components/PublicLayout'
import ThemeProvider from '@/components/ThemeProvider'
import * as URLS from '@/config/urls'
import { AuthenticationProvider } from '@/contexts/Authentication'
import { LOGIN_WITH_SSO } from '@/graphql/mutations/login-with-sso'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'
import { POST_LOGIN_REDIRECT_KEY } from '@/helpers/post-login-redirect'

import SsoCallback from '..'

const AUTH_CODE = 'auth-code'
const STATE = 'state-value'
const ISS = 'https://one.gov.sg/api/auth'
const STORED_REDIRECT = '/pipe/abc-123'

const CURRENT_USER = {
  id: 'user-1',
  email: 'officer@open.gov.sg',
  createdAt: '1700000000000',
  updatedAt: '1700000000000',
}

const loggedOutMock: MockedResponse = {
  request: { query: GET_CURRENT_USER },
  result: { data: { getCurrentUser: null } },
}

const loggedInMock: MockedResponse = {
  request: { query: GET_CURRENT_USER },
  result: { data: { getCurrentUser: CURRENT_USER } },
}

const successfulLoginMock: MockedResponse = {
  request: {
    query: LOGIN_WITH_SSO,
    variables: { input: { authCode: AUTH_CODE, state: STATE, iss: ISS } },
  },
  result: { data: { loginWithSso: true } },
}

function LocationProbe(): JSX.Element {
  const { pathname } = useLocation()
  return <span data-testid="landed-on">{pathname}</span>
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

// IMPORTANT: renders without `act()`. It batches the render that the awaited
// GET_CURRENT_USER refetch triggers, which hides the ordering a browser
// produces between that render and the code resuming after `loginWithSso`.
async function renderCallback(
  mocks: readonly MockedResponse[],
  search: string,
): Promise<void> {
  root.render(
    <ThemeProvider>
      <MockedProvider mocks={[...mocks]} addTypename={false}>
        <AuthenticationProvider>
          <MemoryRouter
            initialEntries={[`${URLS.LOGIN_SSO_REDIRECT}${search}`]}
          >
            <Routes>
              <Route
                path={URLS.LOGIN_SSO_REDIRECT}
                element={
                  <PublicLayout>
                    <SsoCallback />
                  </PublicLayout>
                }
              />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </AuthenticationProvider>
      </MockedProvider>
    </ThemeProvider>,
  )

  for (let i = 0; i < 100 && landedOn() === null; i++) {
    await flushMacrotask()
  }

  // A late write to the stored path only shows up after the redirect renders.
  for (let i = 0; i < 5; i++) {
    await flushMacrotask()
  }
}

function landedOn(): string | null {
  return (
    container.querySelector('[data-testid="landed-on"]')?.textContent ?? null
  )
}

describe('SsoCallback post-login redirect', () => {
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

    sessionStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    sessionStorage.clear()
  })

  it('lands on the stored path after a successful login', async () => {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, STORED_REDIRECT)

    await renderCallback(
      [loggedOutMock, successfulLoginMock, loggedInMock],
      `?code=${AUTH_CODE}&state=${STATE}&iss=${encodeURIComponent(ISS)}`,
    )

    expect(landedOn()).toBe(STORED_REDIRECT)
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })

  it('drops the stored path when the IdP returns an error', async () => {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, STORED_REDIRECT)

    await renderCallback([loggedOutMock], '?error=access_denied')

    expect(landedOn()).toBe(URLS.LOGIN_UNAUTHORIZED)
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })

  it('drops the stored path when the callback parameters are missing', async () => {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, STORED_REDIRECT)

    await renderCallback([loggedOutMock], `?code=${AUTH_CODE}`)

    expect(landedOn()).toBe(URLS.LOGIN)
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })
})
