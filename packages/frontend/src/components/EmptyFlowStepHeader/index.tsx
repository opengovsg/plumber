import { BiRun, BiSolidBolt } from 'react-icons/bi'
import { Flex, Icon, Text, useDisclosure } from '@chakra-ui/react'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

interface EmptyFlowStepHeaderProps {
  isTrigger: boolean
  isLastStep: boolean
  onSubmit: (appKey: string, eventKey: string) => void
}

export default function EmptyFlowStepHeader(
  props: EmptyFlowStepHeaderProps,
): JSX.Element {
  const { isTrigger, isLastStep, onSubmit } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Flex
        w="full"
        borderWidth="1px"
        borderColor="base.divider.medium"
        borderRadius="lg"
        bg="white"
        p={4}
        pl={8}
        h="96px"
        alignItems="center"
        gap={4}
        onClick={onOpen}
        _hover={{
          bg: 'interaction.muted.neutral.hover',
          cursor: 'pointer',
        }}
        _active={{
          bg: 'interaction.muted.neutral.active',
        }}
      >
        <Icon as={isTrigger ? BiSolidBolt : BiRun} boxSize={6} />
        <Text textStyle="subhead-1">
          {isTrigger
            ? 'Choose how you want your workflow to start'
            : 'Choose an action'}
        </Text>
      </Flex>

      <FlowStepConfigurationModal
        isOpen={isOpen}
        onClose={onClose}
        isTrigger={isTrigger}
        isLastStep={isLastStep}
        onSubmit={onSubmit}
      />
    </>
  )
}
