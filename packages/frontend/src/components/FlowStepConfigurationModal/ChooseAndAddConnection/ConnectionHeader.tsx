import { type IApp } from '@plumber/types'

import { BiQuestionMark, BiTransferAlt } from 'react-icons/bi'
import { Box, Flex, Icon, Image, Text } from '@chakra-ui/react'

import mainLogo from '@/assets/logo.svg'

export function AppLogoBox({ imageUrl }: { imageUrl: string }) {
  return (
    <Box
      boxSize={14}
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={2}
    >
      <Image
        src={imageUrl}
        boxSize={10}
        borderStyle="solid"
        fit="contain"
        fallback={
          <Icon boxSize={10} as={BiQuestionMark} color="base.content.default" />
        }
      />
    </Box>
  )
}

interface ConnectionHeaderProps {
  selectedApp: IApp
  headerText: string
}

export default function ConnectionHeader(props: ConnectionHeaderProps) {
  const { selectedApp, headerText } = props
  return (
    <Flex flexDir="column" alignItems="center" gap={4}>
      <Flex justifyContent="center" alignItems="center" gap={2} mt={2}>
        <AppLogoBox imageUrl={mainLogo} />
        <Icon as={BiTransferAlt} boxSize={6} color="base.content.default" />
        <AppLogoBox imageUrl={selectedApp.iconUrl} />
      </Flex>
      <Text textStyle="h4">{headerText}</Text>
    </Flex>
  )
}
