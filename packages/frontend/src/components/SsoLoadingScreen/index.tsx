import { BsArrowRight } from 'react-icons/bs'
import { Flex, Icon, Image, VStack } from '@chakra-ui/react'

import mainLogo from '@/assets/logo.svg'
// Inline as base64: this page loads right after an SSO redirect, before the
// browser can fetch a separate asset file, so an un-inlined image flashes alt text.
import oneGovLogo from '@/assets/onegov-logo.png?inline'
import PrimarySpinner from '@/components/PrimarySpinner'

export default function SsoLoadingScreen(): JSX.Element {
  return (
    <VStack flex={1} alignItems="center" justifyContent="center" gap={8}>
      <Flex alignItems="center" justifyContent="center" gap={8}>
        <Image src={oneGovLogo} alt="one.gov.sg logo" h={10} />
        <Icon as={BsArrowRight} boxSize={8} color="primary.500" />
        <Image src={mainLogo} alt="plumber-logo" w={12} mr={12} />
      </Flex>
      <PrimarySpinner fontSize="3xl" thickness="4px" pr={10} />
    </VStack>
  )
}
