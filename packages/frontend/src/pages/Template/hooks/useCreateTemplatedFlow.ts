import { useApolloClient, useMutation } from '@apollo/client'
import type { ITemplate } from '@plumber/types'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import * as URLS from '@/config/urls'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { GET_FLOW } from '@/graphql/queries/get-flow'

/**
 * @param onDismiss Closes the surface showing the template. It runs before the
 * editor opens so the two screens never overlap.
 */
export function useCreateTemplatedFlow(
  template: ITemplate,
  onDismiss?: () => void,
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
    try {
      await client.query({ query: GET_FLOW, variables: { id: flowId } })
    } catch {
      // Navigate anyway.
    }

    onDismiss?.()
    // Lets React unmount the dismissed surface before the editor renders.
    await new Promise((resolve) => setTimeout(resolve, 0))

    navigate(isDemoTemplate ? URLS.FLOW_WITH_DEMO(flowId) : URLS.FLOW(flowId))
  }, [
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
