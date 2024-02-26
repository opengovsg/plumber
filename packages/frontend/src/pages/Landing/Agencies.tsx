import { Box, Container, Flex, Image } from '@chakra-ui/react'
import CPFLogo from 'assets/landing/CPF.png'
import GovTechLogo from 'assets/landing/GOVTECH.png'
import MindefLogo from 'assets/landing/MINDEF.png'
import MoeLogo from 'assets/landing/MOE.png'
import MohLogo from 'assets/landing/MOH.png'
import MomLogo from 'assets/landing/MOM.png'
import MsfLogo from 'assets/landing/MSF.png'
import SpfLogo from 'assets/landing/SPF.png'

export default function Agencies() {
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
          {[
            MindefLogo,
            MoeLogo,
            GovTechLogo,
            MomLogo,
            CPFLogo,
            MsfLogo,
            SpfLogo,
            MohLogo,
          ].map((logo, index) => (
            <Box flex={1} key={index}>
              <Image src={logo} />
            </Box>
          ))}
          {/* <Image src={MindefLogo} alt="Mindef Logo" h="90px" w="auto" />
          <Image src={MoeLogo} alt="MOE Logo" h="64px" />
          <Image src={GovTechLogo} alt="GovTech Logo" h="42px" />
          <Image src={MomLogo} alt="MOM Logo" h="100%" />
          <Image src={CPFLogo} alt="CPF Logo" h="100%" />
          <Image src={MsfLogo} alt="MSF Logo" h="100%" />
          <Image src={SpfLogo} alt="SPF Logo" h="100%" />
          <Image src={MohLogo} alt="MOH Logo" h="100%" /> */}
        </Flex>
      </Container>
    </Box>
  )
}
