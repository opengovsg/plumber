import { BiRightArrowAlt } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { useCreateFlowContext } from '../contexts/CreateFlowContext'
import { useFlowCreation } from '../hooks/useFlowCreation'

import FlowNameInput from './FlowNameInput'
import ModeSelector from './ModeSelector'

export default function EmptyFlows() {
  const { createMode } = useCreateFlowContext()

  const {
    flowName,
    inputRef,
    handleInputChange,
    isButtonDisabled,
    handleModeSubmit,
    loading,
  } = useFlowCreation()

  return (
    <Flex
      maxW="800px"
      margin="auto"
      rowGap={4}
      flexDir="column"
      pt={{ base: '0', md: '10vh' }}
    >
      <Flex maxW="800px">
        <Text textStyle="h3">How do you want to create your workflow?</Text>
      </Flex>

      <ModeSelector />

      {createMode === 'new' && (
        <FlowNameInput
          inputRef={inputRef}
          flowName={flowName}
          handleInputChange={handleInputChange}
        />
      )}

      {createMode && (
        <Button
          onClick={() => handleModeSubmit()}
          isDisabled={isButtonDisabled}
          isLoading={loading}
        >
          Next <Icon boxSize={6} as={BiRightArrowAlt} />
        </Button>
      )}
    </Flex>
  )
}
