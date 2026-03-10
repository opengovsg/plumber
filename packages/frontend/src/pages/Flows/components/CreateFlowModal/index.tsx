import { FormEvent, useCallback, useMemo, useRef, useState } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [flowName, setFlowName] = useState<string>('')

  // derive button state from current values
  const isButtonDisabled = useMemo(() => {
    // ai builder auto-suggests a name for the pipe
    if (createMode === 'ai') {
      return false
    }
    return flowName.trim() === ''
  }, [createMode, flowName])

  const handleInputChange = () => {
    setFlowName(inputRef.current?.value || '')
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
    // ai builder auto-suggests a name for the pipe, user does not need to specify a name
    if (createMode === 'ai') {
      event.preventDefault()
      onClose()
      navigate(`${URLS.EDITOR}/ai`, { replace: true })
      return
    }

    const trimmedFlowName = inputRef.current?.value.trim()
    if (!trimmedFlowName) {
      return
    }

    // default to new flow
    onCreateFlow(trimmedFlowName)
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
        <FlowNameAndModeContent
          isButtonDisabled={isButtonDisabled}
          loading={loading}
          inputRef={inputRef}
          flowName={flowName}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
        />
        <ModalCloseButton mt={3} />
      </ModalContent>
    </Modal>
  )
}
