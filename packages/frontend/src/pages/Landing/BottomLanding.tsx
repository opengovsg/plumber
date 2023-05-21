import { Button, Container, Text } from '@chakra-ui/react'

export const BottomLanding = () => {
  return (
    <Container py="20vh" textAlign="center">
      <Text textStyle="heading">Streamline your workflows today</Text>
      <Button my={16} w="xs">
        Get started
      </Button>
    </Container>
  )
}
