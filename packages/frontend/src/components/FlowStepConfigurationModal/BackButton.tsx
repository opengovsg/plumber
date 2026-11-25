import { Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { BiChevronLeft } from 'react-icons/bi'

interface BackButtonProps {
  onBack: () => void
  isDisabled?: boolean
}

export default function BackButton(props: BackButtonProps) {
  const { onBack, isDisabled } = props

  return (
    <Button
      variant="clear"
      colorScheme="secondary"
      size="xs"
      onClick={onBack}
      isDisabled={isDisabled}
      leftIcon={<BiChevronLeft size={20} />}
      ml={-4}
    >
      <Text textStyle="subhead-1">Back</Text>
    </Button>
  )
}
