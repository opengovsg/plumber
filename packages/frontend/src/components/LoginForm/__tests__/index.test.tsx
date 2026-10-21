// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import type { MockedResponse } from '@apollo/client/testing'
import { MockedProvider } from '@apollo/client/testing'
import { GraphQLError } from 'graphql'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'
import { REQUEST_OTP } from '@/graphql/mutations/request-otp'
import { VERIFY_OTP } from '@/graphql/mutations/verify-otp'

import LoginForm from '..'

const EMAIL = 'officer@open.gov.sg'
const OTP = 'ABC123'

const requestOtpSuccessMock: MockedResponse = {
  request: { query: REQUEST_OTP, variables: { input: { email: EMAIL } } },
  result: { data: { requestOtp: true } },
}

const requestOtpErrorMock: MockedResponse = {
  request: { query: REQUEST_OTP, variables: { input: { email: EMAIL } } },
  result: { errors: [new GraphQLError('Only .gov.sg emails are allowed.')] },
}

const verifyOtpErrorMock: MockedResponse = {
  request: {
    query: VERIFY_OTP,
    variables: { input: { email: EMAIL, otp: OTP } },
  },
  result: { errors: [new GraphQLError('Invalid OTP')] },
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let unhandledRejections: unknown[]
const onUnhandledRejection = (reason: unknown) => {
  unhandledRejections.push(reason)
}

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await act(flushMacrotask)
  }
}

async function renderLoginForm(mocks: readonly MockedResponse[]) {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <MockedProvider mocks={[...mocks]} addTypename={false}>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </MockedProvider>
      </ThemeProvider>,
    )
  })
}

function getInput(): HTMLInputElement {
  const input = container.querySelector('input')
  expect(input).not.toBeNull()
  return input as HTMLInputElement
}

async function typeAndSubmit(value: string): Promise<void> {
  const input = getInput()
  // IMPORTANT: React ignores direct `input.value` writes on controlled inputs.
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set
  await act(async () => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await settle()
}

describe('LoginForm', () => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null))),
    )

    unhandledRejections = []
    process.on('unhandledRejection', onUnhandledRejection)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    process.off('unhandledRejection', onUnhandledRejection)
    vi.unstubAllGlobals()
  })

  it('keeps the OTP input without an unhandled rejection when the OTP is invalid', async () => {
    await renderLoginForm([requestOtpSuccessMock, verifyOtpErrorMock])

    await typeAndSubmit(EMAIL)
    expect(getInput().getAttribute('autocomplete')).toBe('one-time-code')

    await typeAndSubmit(OTP)

    expect(unhandledRejections).toEqual([])
    expect(getInput().getAttribute('autocomplete')).toBe('one-time-code')
  })

  it('keeps the email input without an unhandled rejection when the OTP request fails', async () => {
    await renderLoginForm([requestOtpErrorMock])

    await typeAndSubmit(EMAIL)

    expect(unhandledRejections).toEqual([])
    expect(getInput().type).toBe('email')
  })
})
