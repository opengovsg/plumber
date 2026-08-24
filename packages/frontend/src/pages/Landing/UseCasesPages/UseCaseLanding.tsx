import { Box, Container, LightMode } from '@chakra-ui/react'
import { ReactNode } from 'react'

import { Footer } from '../Footer'
import HeaderBar from '../HeaderBar'

export default function UseCaseLanding(props: { children: ReactNode }) {
  return (
    <LightMode>
      <Box fontFamily="'DM Sans', sans-serif">
        <HeaderBar />
        <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
          {props.children}
        </Container>
        <Footer />
      </Box>
    </LightMode>
  )
}
