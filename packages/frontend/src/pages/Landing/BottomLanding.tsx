import { Button, Container, Text } from '@chakra-ui/react'

export const BottomLanding = () => {
  return (
    <Container py={{ base: '8vh', md: '15vh' }} textAlign="center">
      <Text textStyle={{ base: 'subheading', md: 'heading' }}>
        Streamline your workflows today
      </Text>
      <Button mt={{ base: '5vh', md: 16 }} w={{ base: 'full', md: 'xs' }}>
        Get started
      </Button>
    </Container>
  )
}
