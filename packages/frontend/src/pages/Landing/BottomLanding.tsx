import { useNavigate } from 'react-router-dom'
import { Button, Container, Text } from '@chakra-ui/react'
import * as URLS from 'config/urls'

export const BottomLanding = () => {
  const navigate = useNavigate()

  return (
    <Container py={{ base: '8vh', md: '15vh' }} textAlign="center">
      <Text textStyle={{ base: 'subheading', md: 'heading' }}>
        Streamline your workflows today
      </Text>
      <Button
        mt={{ base: '5vh', md: 16 }}
        onClick={() => navigate(URLS.LOGIN)}
        w={{ base: 'full', md: 'xs' }}
      >
        Get started
      </Button>
    </Container>
  )
}
