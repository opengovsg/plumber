import { Tooltip } from '@chakra-ui/react'

import type { CheckStepButtonExtensionProps } from '@/app-extensions/types'

function CheckStepButtonExtension({ children }: CheckStepButtonExtensionProps) {
  return (
    <Tooltip
      label="Test email will only be sent to you."
      aria-label="Check step tooltip"
      hasArrow
      shouldWrapChildren
    >
      {children}
    </Tooltip>
  )
}

export default CheckStepButtonExtension
