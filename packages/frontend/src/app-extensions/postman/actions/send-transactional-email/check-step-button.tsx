import { Tooltip } from '@chakra-ui/react'

import type { CheckStepButtonExtensionProps } from '@/app-extensions/types'

function CheckStepButtonExtension({
  children,
  buttonProps: { isDisabled },
}: CheckStepButtonExtensionProps) {
  // We don't have any special tooltips (yet) for if check step button is
  // disabled.
  if (isDisabled) {
    return children
  }

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
