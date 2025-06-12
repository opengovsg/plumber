import { BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi'
import { CgSandClock } from 'react-icons/cg'
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

const waitingIcon = (
  <Icon boxSize={6} as={CgSandClock} color="interaction.warning.default" />
)

export { failureIcon, partialIcon, successIcon, waitingIcon }
