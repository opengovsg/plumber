import { ReactElement } from 'react'
import { Box, Flex, Image } from '@chakra-ui/react'

import textlogo from '@/assets/landing/textlogo.svg'
import LoginForm from '@/components/LoginForm'

export default function Login(): ReactElement {
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
      <LoginForm />
    </Flex>
  )
}
