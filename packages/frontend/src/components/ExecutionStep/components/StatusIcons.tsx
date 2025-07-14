import { BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi'
import { Icon, Image } from '@chakra-ui/react'

import executionWaitingIcon from '@/assets/execution-waiting.svg'

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

const waitingIcon = <Image src={executionWaitingIcon} h={6} />

export { failureIcon, partialIcon, successIcon, waitingIcon }
