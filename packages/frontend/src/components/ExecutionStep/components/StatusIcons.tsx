import { Icon, Image } from '@chakra-ui/react'
import {
  BiSolidCheckCircle,
  BiSolidErrorCircle,
  BiSolidInfoCircle,
} from 'react-icons/bi'

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

// Only used for delay until past timestamp paused errors
const delayPausedIcon = (
  <Icon boxSize={6} as={BiSolidInfoCircle} color="blue.500" />
)

export { delayPausedIcon, failureIcon, partialIcon, successIcon, waitingIcon }
