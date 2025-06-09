import { BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi'
import { Icon } from '@chakra-ui/react'

const successIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
  />
)
const failureIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.critical.default"
  />
)

const partialIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.warning.default"
  />
)

export { failureIcon, partialIcon, successIcon }
