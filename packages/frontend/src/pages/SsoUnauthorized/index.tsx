import { Box, Flex, Image, Link, Text } from '@chakra-ui/react'

import textlogo from '@/assets/landing/textlogo.svg'
import { SUPPORT_FORM_LINK } from '@/config/urls'

export default function SsoUnauthorized(): JSX.Element {
  return (
    <Flex
      flexDir="column"
      flex={1}
      gap={6}
      justifyContent="center"
      px="5vw"
      w={{ base: '90vw', sm: '80vw', lg: '50vw' }}
      margin="auto"
    >
      <Box>
        <Image h={10} src={textlogo} alt="plumber-logo" />
      </Box>
      <Text textStyle="h4">You do not have access to Plumber</Text>
      <Text textStyle="body-1">
        one.gov.sg confirmed your identity, but this login is limited to OGP
        officers. Request access through our{' '}
        <Link href={SUPPORT_FORM_LINK} isExternal>
          support form
        </Link>
        .
      </Text>
    </Flex>
  )
}
