import { BiRun, BiSolidBolt } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

interface EmptyFlowStepHeaderProps {
  isTrigger: boolean
  onModalOpen: () => void
}

export default function EmptyFlowStepHeader(
  props: EmptyFlowStepHeaderProps,
): JSX.Element {
  const { isTrigger, onModalOpen } = props

  return (
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
      onClick={onModalOpen}
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
  )
}
