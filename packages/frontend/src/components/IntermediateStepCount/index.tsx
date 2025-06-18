import * as React from 'react'
import { Box, Text } from '@chakra-ui/react'

type IntermediateStepCountProps = {
  count: number
}

export default function IntermediateStepCount(
  props: IntermediateStepCountProps,
): React.ReactElement {
  const { count } = props

  return (
    <Box
      border="1px solid"
      borderColor="gray.300"
      borderRadius="md"
      h={8}
      w={8}
      minW={8}
      maxW={8}
      display="flex"
      justifyContent="center"
      alignItems="center"
    >
      <Text textStyle="caption-1" color="text.secondary">
        +{count}
      </Text>
    </Box>
  )
}
