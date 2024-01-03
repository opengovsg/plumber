import {
  Box,
  Container,
  Flex,
  flexWrap,
  Grid,
  Hide,
  HStack,
  Image,
  Show,
  Text,
  VStack,
} from '@chakra-ui/react'
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
    <Box bg="white" py={88}>
      <Flex
        py={4}
        justifyContent={{ base: 'space-evenly', md: 'space-around' }}
        bg="secondary.50"
        flexWrap={{ base: 'wrap', md: 'nowrap' }}
      >
        <Image src={MindefLogo} />
        <Image src={MoeLogo} />
        <Image src={GovTechLogo} />
        <Hide below="md">
          <Image src={MomLogo} />
          <Image src={CPFLogo} />
          <Image src={MsfLogo} />
          <Image src={SpfLogo} />
          <Image src={MohLogo} />
        </Hide>
      </Flex>
    </Box>
  )
}
