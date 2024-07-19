import type { SpinnerProps } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'

// use this spinner if you require it to be the primary color
export default function PrimarySpinner(spinnerProps: SpinnerProps) {
  return <Spinner color="primary.500" {...spinnerProps} />
}
