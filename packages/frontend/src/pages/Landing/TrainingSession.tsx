import { BiRightArrowAlt } from 'react-icons/bi'
import { Box, Container, Flex, Spacer, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'

export default function TrainingSession() {
  return (
    <Container py="5.5rem" px={6}>
      <Flex
        flexDir={{ base: 'column', md: 'row' }}
        alignItems={{ base: 'flex-start', md: 'center' }}
        gap={6}
      >
        <Box w={{ base: '100%', md: '60%' }}>
          <Text
            textStyle={{ base: 'h3', md: 'subheading', lg: 'heading' }}
            mb={6}
          >
            Save time for your agency with automations
          </Text>
          <Text textStyle={{ base: 'subhead-2', md: 'h6' }}>
            We are passionate about spreading the benefits of automations
            throughout WOG. Get started on automations for your agency.
          </Text>
        </Box>
        <Spacer></Spacer>
        <Button
          onClick={() => window.open(URLS.PLUMBER_AMA_LINK, '_blank')}
          w={{ base: '100%', md: 'auto' }}
          rightIcon={<BiRightArrowAlt fontSize="1.5rem" />}
        >
          Arrange a training session with us
        </Button>
      </Flex>
    </Container>
  )
}
