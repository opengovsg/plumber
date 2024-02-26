import { useState } from 'react'
import {
  Box,
  Container,
  HStack,
  Image,
  Stack,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react'
import customerIcon from 'assets/landing/Customer.svg'
import itIcon from 'assets/landing/DevWorkflow.svg'
import hrIcon from 'assets/landing/HR.svg'
import marketingIcon from 'assets/landing/Marketing.svg'
import operationsIcon from 'assets/landing/Operations.svg'
import { APP_ICON_URL } from 'config/urls'

const AUTOMATIONS = [
  {
    icon: hrIcon,
    title: 'Human Resource',
    items: [
      {
        steps: ['formsg', 'vault-workspace'],
        title: 'Track onboarding forms',
        description: 'Track completion rate of onboarding forms',
      },
      {
        steps: ['formsg', 'toolbox', 'postman'],
        title: 'Route applications to department',
        description: 'Send job applications to the relevant recipients',
      },
      {
        steps: ['formsg', 'vault-workspace', 'postman'],
        title: 'Store resumes in centralised location',
        description: 'Store resumes in an excel format and send reply email',
      },
    ],
  },
  {
    icon: itIcon,
    title: 'Dev Workflows',
    items: [
      {
        steps: ['scheduler', 'webhook', 'telegram-bot'],
        title: 'Regularly monitor API responses',
        description: 'Send alerts to Telegram if API response is not 200',
      },
      {
        steps: ['formsg', 'webhook', 'postman'],
        title: 'Supplement form data with API calls',
        description:
          'Fetch data from external APIs using values from responses and send data via Postman',
      },
      {
        steps: ['formsg', 'webhook'],
        title: 'Post decrypted form data',
        description:
          'Decrypts form responses and post data to another endpoint',
      },
    ],
  },
  {
    icon: marketingIcon,
    title: 'Marketing',
    items: [
      {
        steps: ['scheduler', 'postman'],
        title: 'Schedule regular marketing emails',
        description: 'Send emails to your mailing list on a regular basis',
      },
      {
        steps: ['formsg', 'delay', 'postman'],
        title: 'Send post-event survey feedback',
        description:
          'Ask for feedback by automatically sending a survey via Postman to attendees after your event',
      },
      {
        steps: ['formsg', 'toolbox', 'vault-workspace'],
        title: 'Create mailing lists',
        description: 'Store form submitter emails in an excel format',
      },
    ],
  },
  {
    icon: operationsIcon,
    title: 'Operations',
    items: [
      {
        steps: ['formsg', 'twilio'],
        title: 'Send customised SMS on form submission',
        description:
          'Automatically send a personalised acknowledgement SMS to a respondent after they submit a form',
      },
      {
        steps: ['formsg', 'postman'],
        title: 'Notify yourself of new form submissions',
        description:
          'Receive a notification from Postman for every new storage-mode form submission is made',
      },
      {
        steps: ['formsg', 'toolbox', 'twilio'],
        title: 'Flag out high priority tickets',
        description: 'Alert relevant parties via SMS for urgent tickets',
      },
    ],
  },
  {
    icon: customerIcon,
    title: 'Customer Support',
    items: [
      {
        steps: ['formsg', 'postman'],
        title: 'Send customised acknowledgement messages',
        description:
          'Automatically send a personalised acknowledgement via Postman to a respondent after they submit their form',
      },
      {
        steps: ['formsg', 'vault-workspace'],
        title: 'Track ticket stats',
        description: 'Track status of incoming tickets in Vault Workspace',
      },
      {
        steps: ['formsg', 'toolbox', 'postman'],
        title: 'Route tickets to different teams',
        description:
          'Redirect formsg responses to relevant teams based on certain conditions',
      },
    ],
  },
]

const AutomationGroupIcon = ({
  icon,
  title,
  active,
  ...props
}: StackProps & {
  icon: string
  title: string
  active?: boolean
}) => {
  return (
    <Stack
      flexDir={{ base: 'row', md: 'column' }}
      bg={active ? 'white' : 'transparent'}
      borderRadius="xl"
      py={{ base: 2, md: 4 }}
      px={{ base: 2, md: 2 }}
      border="1px"
      cursor="pointer"
      borderColor={active ? 'gray.300' : 'gray.200'}
      flex={{ base: 0, md: 1 }}
      align="center"
      justify="center"
      textAlign="center"
      minW="fit-content"
      {...props}
    >
      <Image src={icon} w={{ base: 5, md: 20 }} h={{ base: 5, md: 20 }} />
      <Text fontSize="sm" whiteSpace="nowrap" mt="0 !important">
        {title}
      </Text>
    </Stack>
  )
}

const AutomationItem = ({
  title,
  description,
  steps,
}: {
  title: string
  description: string
  steps: string[]
}) => (
  <VStack
    bg="white"
    borderRadius="md"
    py={8}
    px={8}
    border="1px"
    borderColor="gray.300"
    flex={1}
    textAlign="left"
    align="start"
    spacing={8}
  >
    <HStack>
      {steps?.map((appKey, index) => (
        <Image
          src={APP_ICON_URL(appKey)}
          key={index}
          h={10}
          w={10}
          alt={appKey}
          title={appKey}
        />
      ))}
    </HStack>
    <Box>
      <Text fontSize="md" fontWeight="medium">
        {title}
      </Text>
      <Text mt={4} fontSize="sm">
        {description}
      </Text>
    </Box>
  </VStack>
)

export default function AutomationLanding() {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <Box bg="primary.50" py="88px" maxW="100%" overflow="hidden">
      <Container py={0} px={6}>
        <VStack spacing={{ base: 2, md: 10 }} align="left">
          <Text textStyle="subheading">Automation for everyone</Text>
          <HStack
            wrap={{ base: 'wrap', md: 'nowrap' }}
            justify={{ base: 'flex-start', md: 'space-between' }}
            gap={{ base: 2, md: 4, lg: 8 }}
            spacing={0}
            align={{ base: 'start', md: 'stretch' }}
            w="100%"
          >
            {AUTOMATIONS.map(({ title, icon }, index) => (
              <AutomationGroupIcon
                title={title}
                icon={icon}
                key={`h${index}`}
                onClick={() => setActiveIndex(index)}
                active={index === activeIndex}
              />
            ))}
          </HStack>
          <Stack
            flexDir={{ base: 'column', md: 'row' }}
            justify="space-between"
            spacing={0}
            gap={{ base: 4, md: 8 }}
            py={{ base: 4, md: 10 }}
            align="stretch"
            w="100%"
          >
            {AUTOMATIONS[activeIndex].items?.map(
              ({ title, description, steps }, index) => (
                <AutomationItem
                  title={title}
                  description={description}
                  key={`i${index}`}
                  steps={steps}
                />
              ),
            )}
          </Stack>
        </VStack>
      </Container>
    </Box>
  )
}
