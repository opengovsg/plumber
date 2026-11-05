import type { IFlow } from '@plumber/types'
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Tags every event captured while viewing an AI-builder-created flow, so
 * analytics on this flow stay attributable even on visits after the
 * initial AI builder hand-off.
 */
export function useCaptureAiBuilderFlow(flow: IFlow | undefined): void {
  const posthog = usePostHog()
  const [searchParams] = useSearchParams()
  const isFromAiBuilder = searchParams.get('from') === 'ai-builder'
  const aiBuilderTraceId = flow?.config?.aiBuilderConfig?.traceId

  useEffect(() => {
    if (!aiBuilderTraceId) {
      return
    }
    posthog.register({
      is_ai_builder_flow: true,
      is_first_edit: !!isFromAiBuilder,
    })
    posthog.capture('ai_builder:editing_flow')
    return () => {
      posthog.unregister('is_first_edit')
      posthog.unregister('is_ai_builder_flow')
    }
  }, [aiBuilderTraceId, isFromAiBuilder, posthog])
}
