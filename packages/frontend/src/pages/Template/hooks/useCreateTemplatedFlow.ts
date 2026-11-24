import { useApolloClient, useMutation } from '@apollo/client'
import type { ITemplate } from '@plumber/types'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import * as URLS from '@/config/urls'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { GET_FLOW } from '@/graphql/queries/get-flow'

const PREFETCH_TIMEOUT_MS = 3000

/**
 * @param onDismiss Closes the surface showing the template. It runs before the
 * editor opens so the two screens never overlap.
 * @param replace Replaces the current history entry with the editor.
 */
export function useCreateTemplatedFlow(
  template: ITemplate,
  onDismiss?: () => void,
  replace = false,
) {
  const navigate = useNavigate()
  const client = useApolloClient()
  const [createTemplatedFlow, { loading }] = useMutation(CREATE_TEMPLATED_FLOW)
  // The mutation stops loading before the screen changes. Staying busy until
  // then avoids the button flashing back and a second click creating a pipe.
  const [isNavigating, setIsNavigating] = useState(false)

  const { id, tags } = template
  const isDemoTemplate = tags?.some((tag) => tag === 'demo')
  const isBusy = loading || isNavigating

  const createFromTemplate = useCallback(async () => {
    if (isBusy) {
      return
    }
    const response = await createTemplatedFlow({
      variables: {
        input: {
          templateId: id,
        },
      },
    })
    const flowId = response.data?.createTemplatedFlow?.id
    setIsNavigating(true)

    // Warms the cache so the editor renders at once instead of flashing its
    // loading state. The editor refetches on a miss, so a failure is safe.
    // The deadline stops a stalled query from trapping the user in the modal.
    // IMPORTANT: abort it at the deadline. Apollo deduplicates identical
    // queries, so the editor would otherwise share the stalled request.
    const abortController = new AbortController()
    const timeoutId = setTimeout(
      () => abortController.abort(),
      PREFETCH_TIMEOUT_MS,
    )
    try {
      await client.query({
        query: GET_FLOW,
        variables: { id: flowId },
        context: { fetchOptions: { signal: abortController.signal } },
      })
    } catch {
      // Navigate anyway.
    } finally {
      clearTimeout(timeoutId)
    }

    onDismiss?.()
    // Lets React unmount the dismissed surface before the editor renders.
    await new Promise((resolve) => setTimeout(resolve, 0))

    navigate(isDemoTemplate ? URLS.FLOW_WITH_DEMO(flowId) : URLS.FLOW(flowId), {
      replace,
    })
  }, [
    replace,
    isBusy,
    createTemplatedFlow,
    client,
    id,
    onDismiss,
    navigate,
    isDemoTemplate,
  ])

  return { createFromTemplate, loading: isBusy }
}
