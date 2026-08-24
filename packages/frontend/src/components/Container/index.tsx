import {
  Container as ChakraContainer,
  ContainerProps as ChakraContainerProps,
} from '@chakra-ui/react'
import * as React from 'react'

export type { ChakraContainerProps as ContainerProps }

export default function Container(
  props: ChakraContainerProps,
): React.ReactElement {
  return <ChakraContainer {...props} />
}

Container.defaultProps = {
  maxW: 'container.xl',
}
