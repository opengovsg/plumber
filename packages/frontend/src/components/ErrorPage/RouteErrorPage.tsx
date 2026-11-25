import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import posthog, { isPostHogConfigured } from '@/posthog'

import ErrorPage, { ErrorUnexpectedPageContent } from '.'

// React Router catches route render errors itself, so they never reach
// window.onerror or the root ErrorBoundary.
export default function RouteErrorPage(): JSX.Element {
  const error = useRouteError()

  useEffect(() => {
    if (isPostHogConfigured && !isRouteErrorResponse(error)) {
      posthog.captureException(error)
    }
  }, [error])

  return (
    <ErrorPage>
      <ErrorUnexpectedPageContent />
    </ErrorPage>
  )
}
