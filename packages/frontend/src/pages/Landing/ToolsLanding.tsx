import {
  Box,
  Container,
  Grid,
  GridItem,
  HStack,
  Image,
  Stack,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react'
import { APP_ICON_URL } from 'config/urls'

const AppIntegration = ({ iconName, name, description }) => {
  return (
    <GridItem>
      <VStack
        borderRadius="md"
        py={8}
        px={8}
        border="0px"
        bg="secondary.50"
        flex={1}
        textAlign="left"
        align="start"
        spacing={8}
        h="100%"
        w={{ base: '100%', md: '240' }}
      >
        <Image
          src={APP_ICON_URL(iconName)}
          h={10}
          w={10}
          alt={iconName}
          title={iconName}
        />
        <Box>
          <Text textStyle="subhead-3">{name}</Text>
          <Text mt={4} fontSize="sm">
            {description}
          </Text>
        </Box>
      </VStack>
    </GridItem>
  )
}

export default function ToolsLanding() {
  return (
    <Container py={88} px={{ base: '16px', md: '0px' }}>
      <Text textStyle="h1" textColor="primary.600" pb="16">
        Our tools and integrations
      </Text>
      <VStack gap={64} align="left">
        <Stack gap={12}>
          <VStack align="left">
            <Text textStyle="h5" textColor="primary.600">
              Custom Plumber applications
            </Text>
            <Text textStyle="body-1">
              Plumber has a variety of in-built tools that can help your Pipes
              do more.
            </Text>
          </VStack>
          <Grid
            templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)' }}
            gap={12}
            bgColor="white"
            h="100%"
            w="100%"
          >
            <AppIntegration
              iconName="scheduler"
              name="Scheduler"
              description="Trigger an action on a regular basis. You can also select the hour of the day."
            ></AppIntegration>

            <AppIntegration
              iconName="webhook"
              name="Webhook"
              description="Send real-time data from internal systems to Plumber."
            ></AppIntegration>

            <AppIntegration
              iconName="custom-api"
              name="Custom API"
              description="Use Custom API to send real-time data from Plumber to an external system and streamline your workflows."
            ></AppIntegration>

            <AppIntegration
              iconName="delay"
              name="Delay"
              description="Put your actions on hold for a specified amount of time before sending data to another app."
            ></AppIntegration>

            <AppIntegration
              iconName="toolbox"
              name="If-then"
              description="Conditional logic for your pipes. If-then lets your apps take different actions based on conditions you choose."
            ></AppIntegration>

            <AppIntegration
              iconName="toolbox"
              name="Only continue if"
              description="Only allow a Pipe to proceed when a certain condition is met."
            ></AppIntegration>
          </Grid>
        </Stack>
        <HStack
          w="1144"
          gap={14}
          wrap={{ base: 'wrap', md: 'nowrap', lg: 'nowrap' }}
        >
          <VStack align="left">
            <Text textStyle="h5" textColor="primary.600">
              Integrations
            </Text>
            <Text textStyle="body-1">
              We integrate with OGP products and other popular applications used
              across government.
            </Text>
          </VStack>
          <Grid
            templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)' }}
            px={0}
            gap={11}
            bgColor="white"
            h="100%"
            w="100%"
          >
            <AppIntegration
              iconName="formsg"
              name="FormSG"
              description="Build secure government forms in minutes"
            ></AppIntegration>

            <AppIntegration
              iconName="postman"
              name="Email by Postman"
              description="Reach out to citizens in minutes"
            ></AppIntegration>

            <AppIntegration
              iconName="vault-workspace"
              name="Vault workspace"
              description="Store and share data securely"
            ></AppIntegration>

            <AppIntegration
              iconName="paysg"
              name="PaySG"
              description="A better way for government to accept payments"
            ></AppIntegration>

            <AppIntegration
              iconName="slack"
              name="Slack"
              description="A platform for team communication"
            ></AppIntegration>

            <AppIntegration
              iconName="telegram-bot"
              name="Telegram"
              description="An instant messaging service"
            ></AppIntegration>
          </Grid>
        </HStack>
      </VStack>
    </Container>
  )
}

// export default ToolsLanding
