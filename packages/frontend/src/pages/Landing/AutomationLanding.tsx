import { useState } from 'react'
import {
  Box,
  Container,
  HStack,
  Image,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react'
import customerIcon from 'assets/landing/Customer.svg'
import hrIcon from 'assets/landing/HR.svg'
import itIcon from 'assets/landing/IT.svg'
import marketingIcon from 'assets/landing/Marketing.svg'
import operationsIcon from 'assets/landing/Operations.svg'
import { APP_ICON_URL } from 'config/urls'

const AUTOMATIONS = [
  {
    icon: hrIcon,
    title: 'Human Resource',
    items: [
      {
        steps: ['formsg', 'vault-workspace', 'postman'],
        title: 'Track onboarding forms',
      },
      {
        steps: ['formsg', 'logic', 'postman'],
        title: 'Route applications to department',
      },
      {
        steps: ['formsg', 'vault-workspace', 'postman'],
        title: 'Store resumes in centralised location',
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
      },
      {
        steps: ['formsg', 'webhook', 'postman'],
        title: 'Supplement form data with API calls',
      },
      {
        steps: ['webhook', 'logic', 'webhook'],
        title: 'Proxy webhooks to internal services',
      },
    ],
  },
  {
    icon: marketingIcon,
    title: 'Marketing',
    items: [
      {
        steps: ['postman', 'vault-workspace'],
        title: 'Track campaign stats',
      },
      {
        steps: ['formsg', 'delay', 'postman'],
        title: 'Send post-event survey feedback',
      },
      {
        steps: ['formsg', 'logic', 'webhook'],
        title: 'Create targeted lists',
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
      },
      {
        steps: ['formsg', 'postman'],
        title: 'Notify yourself of new form submissions',
      },
      {
        steps: ['formsg', 'logic', 'slack'],
        title: 'Flag out high priority tickets',
      },
    ],
  },
  {
    icon: customerIcon,
    title: 'Customer Support',
    items: [
      {
        steps: ['scheduler', 'postman'],
        title: 'Send customised acknowledgement messages',
      },
      {
        steps: ['formsg', 'vault-workspace'],
        title: 'Track ticket stats',
      },
      {
        steps: ['formsg', 'logic', 'postman'],
        title: 'Route tickets to different teams',
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
    <VStack
      bg={active ? 'white' : 'transparent'}
      borderRadius="xl"
      py={4}
      px={4}
      border="1px"
      cursor="pointer"
      borderColor={active ? 'gray.300' : 'gray.200'}
      flex={1}
      textAlign="center"
      {...props}
    >
      <Image src={icon} w={20} h={20} />
      <Text fontSize="sm">{title}</Text>
    </VStack>
  )
}

const AutomationItem = ({
  title,
  steps,
}: {
  title: string
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
      <Text fontSize="sm">Some copy here maybe</Text>
    </Box>
  </VStack>
)

export const AutomationLanding = () => {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <Box bg="primary.50" py={8}>
      <Container>
        <VStack spacing={8} align="left">
          <Text textStyle="subheading">Automation for everyone</Text>
          <HStack justify="space-between" spacing={4} align="stretch" w="100%">
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
          <HStack
            justify="space-between"
            spacing={8}
            py={12}
            align="stretch"
            w="100%"
          >
            {AUTOMATIONS[activeIndex].items?.map(({ title, steps }, index) => (
              <AutomationItem title={title} key={`i${index}`} steps={steps} />
            ))}
          </HStack>
        </VStack>
      </Container>
    </Box>
  )
}
