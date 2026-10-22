import {
  Flex,
  Icon,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { FormEvent } from 'react'
import { BiRightArrowAlt } from 'react-icons/bi'
import { Form } from 'react-router-dom'

import {
  FLOW_CREATE_MODE,
  useCreateFlowContext,
} from '@/pages/Flows/contexts/CreateFlowContext'

import FlowNameInput from '../FlowNameInput'
import ModeSelector from '../ModeSelector'

export default function FlowNameAndModeContent({
  isButtonDisabled,
  inputRef,
  loading,
  flowName,
  handleInputChange,
  handleSubmit,
  onModeSelect,
}: {
  isButtonDisabled: boolean
  loading: boolean
  inputRef: React.RefObject<HTMLInputElement>
  flowName: string
  handleInputChange: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
  onModeSelect: (mode: FLOW_CREATE_MODE) => void
}) {
  const { createMode } = useCreateFlowContext()

  return (
    <Form onSubmit={handleSubmit}>
      <ModalHeader pt={8} pb={8} pl={8} pr={16}>
        <Text textStyle="h4">How do you want to create your workflow?</Text>
      </ModalHeader>
      <ModalBody px={8} pt={0} pb={createMode === 'new' ? 6 : 8}>
        <Flex flexDir="column" rowGap={6}>
          <ModeSelector onModeSelect={onModeSelect} />

          {/* Specific form items */}
          {createMode === 'new' && (
            <FlowNameInput
              inputRef={inputRef}
              flowName={flowName}
              handleInputChange={handleInputChange}
            />
          )}
        </Flex>
      </ModalBody>
      {createMode === 'new' && (
        <ModalFooter px={8} pt={0} pb={8}>
          <Button
            type="submit"
            isDisabled={isButtonDisabled}
            isLoading={loading}
          >
            Next <Icon boxSize={6} as={BiRightArrowAlt} />
          </Button>
        </ModalFooter>
      )}
    </Form>
  )
}
