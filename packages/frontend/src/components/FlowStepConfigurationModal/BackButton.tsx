import { Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { BiChevronLeft } from 'react-icons/bi'

interface BackButtonProps {
  onBack: () => void
}

export default function BackButton(props: BackButtonProps) {
  const { onBack } = props

  return (
    <Button
      variant="clear"
      colorScheme="secondary"
      size="xs"
      onClick={onBack}
      leftIcon={<BiChevronLeft size={20} />}
      ml={-4}
    >
      <Text textStyle="subhead-1">Back</Text>
    </Button>
  )
}
