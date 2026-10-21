import type { IFlow } from '@plumber/types'

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import posthog, { isPostHogConfigured } from '@/posthog'

/**
 * Tags every event captured while viewing an AI-builder-created flow, so
 * analytics on this flow stay attributable even on visits after the
 * initial AI builder hand-off.
 */
export function useCaptureAiBuilderFlow(flow: IFlow | undefined): void {
  const [searchParams] = useSearchParams()
  const isFromAiBuilder = searchParams.get('from') === 'ai-builder'
  const aiBuilderTraceId = flow?.config?.aiBuilderConfig?.traceId

  useEffect(() => {
    if (!isPostHogConfigured || !aiBuilderTraceId) {
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
  }, [aiBuilderTraceId, isFromAiBuilder])
}
