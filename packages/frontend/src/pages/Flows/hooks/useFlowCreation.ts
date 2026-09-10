import { useMutation } from '@apollo/client'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import * as URLS from '@/config/urls'
import { CREATE_FLOW } from '@/graphql/mutations/create-flow'
import {
  FLOW_CREATE_MODE,
  useCreateFlowContext,
} from '@/pages/Flows/contexts/CreateFlowContext'

export const useFlowCreation = () => {
  const navigate = useNavigate()
  const { createMode } = useCreateFlowContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [createFlow, { loading }] = useMutation(CREATE_FLOW)
  const [flowName, setFlowName] = useState<string>('')

  const handleInputChange = useCallback(() => {
    setFlowName(inputRef.current?.value || '')
  }, [])

  const isButtonDisabled = flowName.trim() === ''

  const onCreateFlow = useCallback(
    async (flowName: string) => {
      const response = await createFlow({
        variables: {
          input: {
            flowName,
          },
        },
      })
      navigate(URLS.FLOW_EDITOR(response.data?.createFlow?.id), {
        replace: true,
      })
    },
    [createFlow, navigate],
  )

  const handleModeSubmit = useCallback(
    (options?: { onClose?: () => void; mode?: FLOW_CREATE_MODE }) => {
      const mode = options?.mode ?? createMode

      if (mode === 'ai') {
        options?.onClose?.()
        navigate(`${URLS.EDITOR}/ai`, { replace: true })
        return
      }

      if (mode === 'template') {
        options?.onClose?.()
        navigate(URLS.TEMPLATES)
        return
      }

      const trimmedFlowName = inputRef.current?.value.trim()
      if (!trimmedFlowName) {
        return
      }

      options?.onClose?.()
      onCreateFlow(trimmedFlowName)
    },
    [createMode, navigate, inputRef, onCreateFlow],
  )

  return {
    flowName,
    inputRef,
    handleInputChange,
    isButtonDisabled,
    onCreateFlow,
    handleModeSubmit,
    loading,
  }
}
