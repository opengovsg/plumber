import { Box, HStack, Image, Text } from '@chakra-ui/react'

export default function Illustration() {
  return (
    <Box as="figure" mt={4}>
      <Image
        src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&w=1310&h=873&q=80&facepad=3"
        alt=""
        aspectRatio={16 / 9}
        borderRadius="xl"
        bg="gray.50"
        objectFit="cover"
        w="full"
      />
      <HStack
        as="figcaption"
        mt={4}
        spacing={2}
        fontSize="sm"
        lineHeight={6}
        color="gray.500"
      >
        <Text>Happy HR staff</Text>
      </HStack>
    </Box>
  )
}
