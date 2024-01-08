import { Box, Flex, Hide, Image } from '@chakra-ui/react'
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
    <Box bg="white" py="5.5rem">
      <Flex
        py={4}
        justifyContent="space-evenly"
        bg="secondary.50"
        flexWrap="wrap"
      >
        <Image src={MindefLogo} />
        <Image src={MoeLogo} />
        <Image src={GovTechLogo} />
        <Hide below="sm">
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
