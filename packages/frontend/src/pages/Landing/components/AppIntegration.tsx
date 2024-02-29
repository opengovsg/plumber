import { Box, Flex, Image, Text } from '@chakra-ui/react'
import { APP_ICON_URL } from 'config/urls'

export interface AppIntegrationProps {
  iconName: string
  name: string
  description: string
}

export default function AppIntegration(props: AppIntegrationProps) {
  const { iconName, name, description } = props
  return (
    <Flex
      flexDir="column"
      borderRadius="md"
      p={4}
      bg="secondary.50"
      gap={4}
      h="100%"
    >
      <Image
        src={APP_ICON_URL(iconName)}
        h={8}
        w={8}
        alt={iconName}
        title={iconName}
      />
      <Box>
        <Text textStyle="subhead-3">{name}</Text>
        <Text mt={4} fontSize="sm">
          {description}
        </Text>
      </Box>
    </Flex>
  )
}
