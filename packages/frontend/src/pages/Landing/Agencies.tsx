import {
  Box,
  Center,
  Container,
  Image,
  Link,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'

import GovTechLogo from '@/assets/landing/GOVTECH.png'
import MindefLogo from '@/assets/landing/MINDEF.png'
import MoeLogo from '@/assets/landing/MOE.png'
import MohLogo from '@/assets/landing/MOH.png'
import MomLogo from '@/assets/landing/MOM.png'
import SpfLogo from '@/assets/landing/SPF.png'

interface LogoImageProps {
  src: string
  alt: string
}

const ALL_LOGO_IMAGES: LogoImageProps[] = [
  {
    src: SpfLogo,
    alt: 'Singapore Police Force',
  },
  {
    src: GovTechLogo,
    alt: 'Government Technology Agency',
  },
  {
    src: MindefLogo,
    alt: 'Ministry of Defence',
  },
  {
    src: MoeLogo,
    alt: 'Ministry of Education',
  },
  {
    src: MohLogo,
    alt: 'Ministry of Health',
  },
  {
    src: MomLogo,
    alt: 'Ministry of Manpower',
  },
]

const LogoImage = ({ src, alt }: LogoImageProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={158}
      height={48}
      maxH={24}
      w="full"
      objectFit="contain"
      filter="grayscale(100%) contrast(1.2) brightness(1.1)"
      opacity={0.7}
      transition="all 0.3s ease"
      _hover={{ filter: 'grayscale(0%)', opacity: 1 }}
    />
  )
}

export default function Agencies() {
  return (
    <Box bg="white" pt={{ base: 24, sm: 32 }}>
      <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
        <SimpleGrid
          columns={{ base: 3, sm: 6, lg: 6 }}
          spacing={{ base: 8, sm: 10 }}
          spacingY={{ base: 12, sm: 14 }}
          maxW={{ base: 'lg', sm: 'xl', lg: 'none' }}
          mx={{ base: 'auto', lg: 0 }}
          alignItems="center"
        >
          {ALL_LOGO_IMAGES.map(({ src, alt }) => (
            <LogoImage key={alt} src={src} alt={alt} />
          ))}
        </SimpleGrid>

        <Center mt={16}>
          <Box
            position="relative"
            borderRadius="full"
            bg="primary.50"
            px={4}
            py={1.5}
            fontSize="sm"
            lineHeight="6"
            color="gray.600"
            border="1px solid"
            borderColor="primary.500"
            opacity={0.95}
          >
            <Text as="span" display={{ base: 'none', md: 'inline' }}>
              Over 190 agencies use Plumber to automate their workflows.
            </Text>
            <Link
              href="use-cases"
              fontWeight="500"
              color="primary.500"
              textDecoration="none"
              _hover={{ color: 'primary.600' }}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('use-cases')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
            >
              <Box position="absolute" inset={0} aria-hidden="true" /> Read use
              cases{' '}
              <Text as="span" aria-hidden="true">
                →
              </Text>
            </Link>
          </Box>
        </Center>
      </Container>
    </Box>
  )
}
