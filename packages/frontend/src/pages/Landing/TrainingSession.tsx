import { useNavigate } from 'react-router-dom'
import { Container, HStack, Text, VStack } from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'

export default function TrainingSession() {
  const navigate = useNavigate()
  return (
    <Container py={88}>
      <VStack align="left" maxW="720" gap={5}>
        <Text textStyle={{ base: 'h3', md: 'heading' }}>
          Save time for your agency with automations
        </Text>
        <Text textStyle={{ base: 'subhead-2', md: 'h6' }}>
          We are passionate about spreading the benefits of automations
          throughout WOG. Get started on automations for your agency.
        </Text>
        <Button onClick={() => navigate('/go.gov.sg/plumber-ama')} width="50%">
          Arrange a training session with us
        </Button>
      </VStack>
    </Container>
  )
}
