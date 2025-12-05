import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import { datadogRum } from '@datadog/browser-rum'
import { debounce } from 'lodash'

import { REFINE_FORM_INPUT } from '@/graphql/mutations/ai/refine-form-input'

export const useRefineFormInput = () => {
  const ddSessionId = datadogRum.getInternalContext()?.session_id ?? ''
  const [refineFormInput, { loading: isRefiningFormInput }] =
    useMutation(REFINE_FORM_INPUT)

  const isFromSuggestionRef = useRef(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [showReadyMessage, setShowReadyMessage] = useState(false)

  const callRefineFormInput = useCallback(
    async (triggerPrompt: string, actionsPrompt: string) => {
      // Skip if the value is from a suggestion
      if (isFromSuggestionRef.current) {
        isFromSuggestionRef.current = false
        return
      }

      // Combine trigger and actions into a single prompt
      const combinedPrompt =
        `data source:${triggerPrompt}\n workflow description:${actionsPrompt}`.trim()

      // Skip if combined prompt is empty or too short (minimum 30 characters required by API)
      if (!combinedPrompt || combinedPrompt.length < 30) {
        setAiSuggestion(null)
        setShowReadyMessage(false)
        return
      }

      try {
        const result = await refineFormInput({
          variables: {
            input: {
              prompt: combinedPrompt,
              sessionId: ddSessionId,
            },
          },
        })

        if (result.data?.refineFormInput) {
          const { status, suggestion } = result.data.refineFormInput
          if (status) {
            // Status is true - show ready message
            setShowReadyMessage(true)
            setAiSuggestion(null)
          } else if (suggestion) {
            // Status is false and we have a suggestion
            setAiSuggestion(suggestion)
            setShowReadyMessage(false)
          } else {
            setAiSuggestion(null)
            setShowReadyMessage(false)
          }
        }
      } catch (error) {
        console.error('Error refining form input:', error)
        setAiSuggestion(null)
        setShowReadyMessage(false)
      }
    },
    [refineFormInput, ddSessionId],
  )

  const debouncedRefineFormInput = useMemo(
    () => debounce(callRefineFormInput, 2000),
    [callRefineFormInput],
  )

  const resetSuggestion = useCallback(() => {
    isFromSuggestionRef.current = true
    debouncedRefineFormInput.cancel()
    setAiSuggestion(null)
    setShowReadyMessage(false)
  }, [debouncedRefineFormInput])

  return {
    refineFormInput: debouncedRefineFormInput,
    isRefiningFormInput,
    aiSuggestion,
    showReadyMessage,
    resetSuggestion,
  }
}
