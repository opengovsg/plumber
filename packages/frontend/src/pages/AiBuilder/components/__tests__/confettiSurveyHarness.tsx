import { ReactElement } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import appConfig from '@/config/app'
import { theme } from '@/theme'

type QuestionProperties =
  | { type: 'open-ended'; max: number; placeholder?: string }
  | { type: 'rating'; scale: number; display?: 'number' | 'star' | 'emoji' }

interface SurveyQuestionInput {
  id: string
  title: string
  required: boolean
  properties: QuestionProperties
}

export interface ConfettiApiCall {
  method: string
  url: string
  body: unknown
}

export function buildSurvey(questions: SurveyQuestionInput[]) {
  return {
    title: 'AI Builder survey',
    description: '',
    questions: questions.map((question, position) => ({
      ...question,
      description: '',
      position,
      routingLogic: { type: 'always', target: { type: 'next' } },
    })),
    confirmation: {
      title: 'Feedback submitted!',
      description: 'Thank you for your feedback!',
      buttonText: 'Close',
    },
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Serves the Confetti endpoints the SDK calls, so tests exercise the real
 * widget against a survey definition instead of a stubbed component.
 */
export function mockConfettiApi({
  survey,
  failSurveyFetch = false,
}: {
  survey?: ReturnType<typeof buildSurvey>
  failSurveyFetch?: boolean
}) {
  const calls: ConfettiApiCall[] = []

  vi.stubGlobal('fetch', async (input: Request) => {
    const { method, url } = input
    const rawBody = method === 'GET' ? '' : await input.clone().text()
    calls.push({
      method,
      url,
      body: rawBody ? JSON.parse(rawBody) : undefined,
    })

    if (url.includes('/respondent/')) {
      return jsonResponse({
        lastRespondedAt: null,
        lastViewedAt: null,
        lastDismissedAt: null,
      })
    }
    if (url.includes('/response/')) {
      return jsonResponse({})
    }
    if (failSurveyFetch || !survey) {
      return new Response('{}', { status: 500 })
    }
    return jsonResponse(survey)
  })

  return {
    calls,
    submittedResponses: () =>
      calls.filter(
        (call) => call.method === 'PUT' && call.url.includes('/response/'),
      ),
  }
}

/**
 * jsdom ships none of these, and Chakra plus the Confetti widget both need
 * them during render.
 */
export function installBrowserStubs() {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList)
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: () => '11111111-2222-3333-4444-555555555555',
    })
  }
}

export function renderWithTheme(ui: ReactElement) {
  return render(<ChakraProvider theme={theme}>{ui}</ChakraProvider>)
}

export const surveyApiBaseUrl = appConfig.confettiApiBaseUrl
