import {
  Box,
  Container,
  Flex,
  Image,
  useBreakpointValue,
} from '@chakra-ui/react'
import CPFLogo from 'assets/landing/CPF.png'
import GovTechLogo from 'assets/landing/GOVTECH.png'
import MindefLogo from 'assets/landing/MINDEF.png'
import MoeLogo from 'assets/landing/MOE.png'
import MohLogo from 'assets/landing/MOH.png'
import MomLogo from 'assets/landing/MOM.png'
import MsfLogo from 'assets/landing/MSF.png'
import SpfLogo from 'assets/landing/SPF.png'

const ALL_LOGOS = [
  MindefLogo,
  MoeLogo,
  GovTechLogo,
  MomLogo,
  CPFLogo,
  MsfLogo,
  SpfLogo,
  MohLogo,
]

export default function Agencies() {
  const numLogosToShow = useBreakpointValue({
    base: 3,
    xs: 3,
    sm: 4,
    md: 6,
    lg: ALL_LOGOS.length,
  })

  return (
    <Box my="6vh" bg="secondary.50">
      <Container py={10}>
        <Flex
          justifyContent="flex-start"
          alignItems="center"
          flexWrap="wrap"
          opacity={0.8}
          filter="grayscale(90%)"
          gap={8}
          overflow="hidden"
        >
          {ALL_LOGOS.slice(0, numLogosToShow).map((logo, index) => (
            <Box flex={1} key={index}>
              <Image src={logo} />
            </Box>
          ))}
        </Flex>
      </Container>
    </Box>
  )
}
