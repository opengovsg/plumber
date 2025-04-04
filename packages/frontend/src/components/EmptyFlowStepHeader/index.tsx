import { BiPlus, BiSolidBolt } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

interface EmptyFlowStepHeaderProps {
  isDrawerOpen: boolean
  isTrigger: boolean
  onModalOpen: () => void
}

export default function EmptyFlowStepHeader(
  props: EmptyFlowStepHeaderProps,
): JSX.Element {
  const { isDrawerOpen, isTrigger, onModalOpen } = props
  const isMobile = useIsMobile()

  return (
    <Flex
      // w="full"
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
      w={
        isDrawerOpen
          ? isMobile
            ? '0px'
            : '100%'
          : isMobile
          ? '100vw'
          : '55rem'
      }
    >
      <Icon as={isTrigger ? BiSolidBolt : BiPlus} boxSize={6} />
      <Text textStyle="subhead-1">
        {isTrigger ? 'Choose how you want your workflow to start' : 'Add step'}
      </Text>
    </Flex>
  )
}
