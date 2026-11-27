import { Flex, ModalCloseButton } from '@chakra-ui/react'

import BackButton from '@/components/FlowStepConfigurationModal/BackButton'

interface BackAndCloseRowProps {
  onBack: () => void
  isDisabled?: boolean
}

/**
 * Back and close share one centred row so they stay level at any button size.
 */
export default function BackAndCloseRow(props: BackAndCloseRowProps) {
  const { onBack, isDisabled } = props

  return (
    <Flex alignItems="center" justifyContent="space-between" px={8}>
      <BackButton onBack={onBack} isDisabled={isDisabled} />
      <ModalCloseButton
        position="static"
        // Pulls the icon, not its hit area, onto the content's right edge.
        mr={-2.5}
        isDisabled={isDisabled}
      />
    </Flex>
  )
}
