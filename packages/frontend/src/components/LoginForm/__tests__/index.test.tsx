// @vitest-environment jsdom
import { ApolloError } from '@apollo/client'
import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LoginForm from '..'

const mutations = vi.hoisted(() => ({
  REQUEST_OTP: vi.fn(),
  VERIFY_OTP: vi.fn(),
}))

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useMutation: (document: 'REQUEST_OTP' | 'VERIFY_OTP') => [
    mutations[document],
    { loading: false },
  ],
}))
vi.mock('@/graphql/mutations/request-otp', () => ({
  REQUEST_OTP: 'REQUEST_OTP',
}))
vi.mock('@/graphql/mutations/verify-otp', () => ({ VERIFY_OTP: 'VERIFY_OTP' }))
vi.mock('@/contexts/LaunchDarkly', async () => ({
  LaunchDarklyContext: (await import('react')).createContext({
    error: null,
    getFlagValue: () => null,
  }),
}))
vi.mock('@/hooks/useResponseHeaders', () => ({ useResponseHeaders: () => ({}) }))
vi.mock('../EmailInput', () => ({ default: () => <div data-step="email" /> }))
vi.mock('../OtpInput', () => ({ default: () => <div data-step="otp" /> }))

const invalidOtpError = new ApolloError({ errorMessage: 'Invalid OTP' })

let container: HTMLDivElement
let root: Root
const unhandledRejections: unknown[] = []
const onUnhandledRejection = (reason: unknown) => {
  unhandledRejections.push(reason)
}

const currentStep = () =>
  container.querySelector('[data-step]')?.getAttribute('data-step')

async function submit() {
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  unhandledRejections.length = 0
  process.on('unhandledRejection', onUnhandledRejection)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<LoginForm />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  process.off('unhandledRejection', onUnhandledRejection)
  vi.clearAllMocks()
})

describe('LoginForm', () => {
  it('stays on the email step when requesting an OTP fails', async () => {
    mutations.REQUEST_OTP.mockRejectedValue(invalidOtpError)

    await submit()

    expect(mutations.REQUEST_OTP).toHaveBeenCalledOnce()
    expect(unhandledRejections).toEqual([])
    expect(currentStep()).toBe('email')
  })

  it('stays on the OTP step when verifying the OTP fails', async () => {
    mutations.REQUEST_OTP.mockResolvedValue({})
    mutations.VERIFY_OTP.mockRejectedValue(invalidOtpError)

    await submit()
    expect(currentStep()).toBe('otp')
    await submit()

    expect(mutations.VERIFY_OTP).toHaveBeenCalledOnce()
    expect(unhandledRejections).toEqual([])
    expect(currentStep()).toBe('otp')
  })
})
