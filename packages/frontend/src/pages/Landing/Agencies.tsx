import { Box, Container, Flex, Image } from '@chakra-ui/react'
import CPFLogo from 'assets/landing/CPF.svg'
import GovTechLogo from 'assets/landing/GOVTECH.svg'
import MindefLogo from 'assets/landing/MINDEF.svg'
import MoeLogo from 'assets/landing/MOE.svg'
import MohLogo from 'assets/landing/MOH.svg'
import MomLogo from 'assets/landing/MOM.svg'
import MsfLogo from 'assets/landing/MSF.svg'
import SpfLogo from 'assets/landing/SPF.svg'

export default function Agencies() {
  return (
    <Box my="6vh" bg="secondary.50">
      <Container>
        <Flex
          h={28}
          maxH={28}
          maxW="100%"
          justifyContent="space-around"
          flexWrap="wrap"
          opacity={0.8}
          filter="grayscale(90%)"
          gap={10}
          overflow="hidden"
        >
          <Image src={MindefLogo} />
          <Image src={MoeLogo} />
          <Image src={GovTechLogo} />
          <Image src={MomLogo} />
          <Image src={CPFLogo} />
          <Image src={MsfLogo} />
          <Image src={SpfLogo} />
          <Image src={MohLogo} />
        </Flex>
      </Container>
    </Box>
  )
}
