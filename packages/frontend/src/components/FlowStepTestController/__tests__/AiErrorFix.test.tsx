// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import AiErrorFix, { clearStepFixNotice } from '../AiErrorFix'

const helpProps = {
  stepId: '11111111-1111-4111-8111-111111111111',
  appName: 'Excel',
  appKey: 'm365-excel',
  stepKey: 'createTableRow',
  stepName: 'Create table row',
  errorName: 'Column not found',
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let client: ApolloClient<object>

function stubMatchMedia(): void {
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
}

async function renderFix({ isDisabled = false } = {}): Promise<void> {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <ApolloProvider client={client}>
          <AiErrorFix.Provider {...helpProps}>
            <AiErrorFix.Action isDisabled={isDisabled} />
            <AiErrorFix.Status />
          </AiErrorFix.Provider>
        </ApolloProvider>
      </ThemeProvider>,
    )
  })
}

function helpButton(): HTMLButtonElement | null {
  return document.body.querySelector('[data-test="fix-with-ai"]')
}

describe('AiErrorFix', () => {
  beforeEach(() => {
    stubMatchMedia()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    client = new ApolloClient({ cache: new InMemoryCache() })
    vi.spyOn(client, 'refetchQueries').mockResolvedValue([] as never)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    clearStepFixNotice(helpProps.stepId)
    vi.unstubAllGlobals()
  })

  it('shows progress and the fix summary', async () => {
    let finish: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => {
      finish = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))

    await renderFix()

    await act(async () => {
      helpButton()?.click()
    })
    expect(document.body.textContent).toContain('Working')

    const request = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(request?.[1]?.body))).toEqual(helpProps)

    await act(async () => {
      finish({
        ok: true,
        json: async () => ({
          data: { fixed: true, summary: 'Updated the Name column mapping' },
        }),
      })
      await pending
    })

    expect(document.body.textContent).toContain(
      'Updated the Name column mapping. Check step again.',
    )
    expect(client.refetchQueries).toHaveBeenCalled()

    await act(async () => {
      root.unmount()
      root = createRoot(container)
      root.render(
        <ThemeProvider>
          <ApolloProvider client={client}>
            <AiErrorFix.Provider {...helpProps}>
              <AiErrorFix.Status />
            </AiErrorFix.Provider>
          </ApolloProvider>
        </ThemeProvider>,
      )
    })

    expect(document.body.textContent).toContain('Check step again.')
  })

  it('shows a failed fix and a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'The Plumber guide is unavailable. Please try again.',
        }),
      }),
    )

    await renderFix()
    await act(async () => {
      helpButton()?.click()
    })

    expect(document.body.textContent).toContain(
      'The Plumber guide is unavailable. Please try again.',
    )
    expect(helpButton()?.textContent).toContain('Fix with AI')
  })

  it('disables Fix with AI while the form has unsaved changes', async () => {
    await renderFix({ isDisabled: true })

    expect(helpButton()?.disabled).toBe(true)
  })
})
