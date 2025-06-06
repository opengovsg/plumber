import { useContext } from 'react'
import { BiPlus, BiSolidBolt } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import { pulsingBoxStyles } from './styles'

interface EmptyFlowStepHeaderProps {
  isTrigger: boolean
  onModalOpen: () => void
  isNested?: boolean
}

export default function EmptyFlowStepHeader(
  props: EmptyFlowStepHeaderProps,
): JSX.Element {
  const { isTrigger, onModalOpen, isNested } = props
  const { isDrawerOpen, isMobile, isEmptyPipe } = useContext(EditorContext)

  return (
    <Flex
      data-test="flow-step"
      borderWidth="1px"
      borderColor="base.divider.medium"
      borderRadius="lg"
      bg="white"
      p={4}
      h={isNested ? '48px' : '64px'}
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
      w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
      sx={isEmptyPipe && isTrigger ? pulsingBoxStyles : {}}
    >
      <Icon
        as={isTrigger ? BiSolidBolt : BiPlus}
        boxSize={6}
        color="interaction.sub.default"
      />
      <Text textStyle="subhead-1" noOfLines={1}>
        {isTrigger ? 'Choose how you want your workflow to start' : 'Add step'}
      </Text>
    </Flex>
  )
}
