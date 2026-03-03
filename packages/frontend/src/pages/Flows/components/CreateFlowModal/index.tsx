import { FormEvent, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
} from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { CREATE_FLOW } from '@/graphql/mutations/create-flow'
import { AIFormModalContent } from '@/pages/AiBuilder/components/AIFormModalContent'
import { AiFormData } from '@/pages/AiBuilder/schema'
import { useCreateFlowContext } from '@/pages/Flows/contexts/CreateFlowContext'

import FlowNameAndModeContent from './FlowNameAndModeContent'

interface CreateFlowModalProps {
  onClose: () => void
}

export default function CreateFlowModal(props: CreateFlowModalProps) {
  const { onClose } = props
  const { createMode } = useCreateFlowContext()

  const navigate = useNavigate()
  const [createFlow, { loading }] = useMutation(CREATE_FLOW)
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showAiModalContent, setShowAiModalContent] = useState<boolean>(false)
  const [flowName, setFlowName] = useState<string>('')

  // to minimise the re-renders to the max, didn't use react hook form cus overkill
  const handleInputChange = () => {
    const inputValue = inputRef.current?.value || ''
    const trimmedInputValue = inputValue.trim()
    setFlowName(inputValue)
    if (trimmedInputValue !== '') {
      if (isButtonDisabled) {
        setIsButtonDisabled(false)
      }
    } else {
      if (!isButtonDisabled) {
        setIsButtonDisabled(true)
      }
    }
  }

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const trimmedFlowName = inputRef.current?.value.trim()
    if (!trimmedFlowName) {
      return
    }

    if (createMode === 'ai') {
      event.preventDefault()
      onClose()
      navigate(`${URLS.EDITOR}/ai`, {
        state: { flowName: trimmedFlowName, isFormMode: false },
        replace: true,
      })
      return
    }

    // default to new flow
    onCreateFlow(trimmedFlowName)
  }

  const handleAiFormSubmit = (data: AiFormData) => {
    onClose()
    navigate(`${URLS.EDITOR}/ai`, {
      state: {
        flowName,
        isFormMode: true,
        formInput: {
          trigger: data.trigger,
          actions: data.actions,
        },
      },
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent>
        {showAiModalContent ? (
          <AIFormModalContent
            type="create"
            onBack={() => setShowAiModalContent(false)}
            onSubmit={handleAiFormSubmit}
          />
        ) : (
          <FlowNameAndModeContent
            isButtonDisabled={isButtonDisabled}
            loading={loading}
            inputRef={inputRef}
            flowName={flowName}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
          />
        )}
        <ModalCloseButton mt={3} />
      </ModalContent>
    </Modal>
  )
}
