import { Box, Flex, keyframes } from '@chakra-ui/react'

// Animated dots keyframes
const dotFlashing = keyframes`
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
`

function Dot({ animation }: { animation: string }) {
  return (
    <Box
      as="span"
      w="6px"
      h="6px"
      borderRadius="full"
      bg="gray.500"
      animation={animation}
    />
  )
}

export default function Loader() {
  return (
    <Flex gap={1} align="center">
      <Dot animation={`${dotFlashing} 1.4s infinite ease-in-out`} />
      <Dot animation={`${dotFlashing} 1.4s infinite ease-in-out 0.2s`} />
      <Dot animation={`${dotFlashing} 1.4s infinite ease-in-out 0.4s`} />
    </Flex>
  )
}
