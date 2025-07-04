import {
  chakra,
  Box,
  Container,
  Flex,
  Icon,
  IconButton,
  Image,
  Stack,
  Text,
  useDisclosure,
  Button,
  Collapse,
  useBreakpointValue,
  VStack,
  HStack,
  Link,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Grid,
  AspectRatio,
  SimpleGrid,
  Center
} from '@chakra-ui/react'
import { BiChevronRight, BiChevronDown, BiGroup, BiSupport, BiCog, BiMenu, BiX } from 'react-icons/bi'
import NoCode from '@/assets/landing/NoCode.svg'
import textlogo from '@/assets/landing/textlogo.svg'
import { Link as RouterLink } from 'react-router-dom'
import Lottie from 'lottie-react'
import HeroLottie from '@/assets/landing/HeroLottie.json'
import Integrations from '@/assets/landing/Integrations.json'
import AgcLogo from '@/assets/landing/AgcLogo.svg'
import GovTechLogo from '@/assets/landing/GOVTECH.png'
import MindefLogo from '@/assets/landing/MINDEF.png'
import MoeLogo from '@/assets/landing/MOE.png'
import MohLogo from '@/assets/landing/MOH.png'
import MomLogo from '@/assets/landing/MOM.png'
import SpfLogo from '@/assets/landing/SPF.png'


const products = [
  {
    name: 'Human Resource',
    description: 'Streamline onboarding and offboarding',
    to: 'Landing/UseCases/HumanResource',
    icon: BiGroup
  },
  {
    name: 'Operations',
    description: 'Monitor on the ground movement',
    to: 'Landing/UseCases/Operations',
    icon: BiCog
  },
  { name: 'Customer support', description: 'Respond to tickets efficiently', to: '#', icon: BiSupport },
]

const features1 = [
  {
    name: 'Build with our visual editor.',
    description:
      'Choose what happens in your workflow, fill in some fields and you are all set.',
    icon: BiMenu,
  },
  {
    name: 'Build faster with templates.',
    description: 'Get up and running instantly with customizable templates that have been tried and tested by other agencies.',
    icon: BiMenu,
  },
]

const features2 = [
  {
    name: 'WoG tools and commercial services.',
    description:
      'We are integrated with M365 Excel, FormSG, Postman and more.',
    icon: BiMenu,
  },
  {
    name: 'Built in tools.',
    description: 'Expand what your workflow does with our built in tools that can handle logic.',
    icon: BiMenu,
  },
  {
    name: 'Connect to your favourite tools with just a few clicks.',
    description: 'No API keys needed.',
    icon: BiMenu,
  },
]

const posts = [
  {
    id: 1,
    title: "How Attorney General's Chamber reduced 50% of time spent on administrative onboarding processes",
    href: "Landing/UseCases/HumanResource",
    description: " ",
    imageUrl: AgcLogo,
    agency: "Attorney General's Chamber",
  },
  // {
  //   id: 2,
  //   title: "How Sentosa saved $10-12k in operating costs by using Plumber to automate their speeding fines process",
  //   href: "Landing/UseCases/Operations",
  //   description: " ",
  //   imageUrl: AgcLogo,
  //   agency: "Sentosa",
  // }
]

const faqs = [
  {
    question: 'Is Plumber free?',
    answer: 'Yes, just log in with your gov.sg email address to try it out.',
  },
  {
    question: 'How is Plumber different from other automation tools?',
    answer: 'We are focused on making Plumber as user -friendly as possible. We are also integrated with other OGP tools such as FormSG, LetterSG and PaySG. ',
  },
  {
    question: 'Do you offer technical support?',
    answer: 'If you run into any difficulties setting up your workflows, you can reach out to us at https://go.gov.sg/plumber-support.',
  },
  {
    question: 'Which agencies are using Plumber?',
    answer: 'There are over 190 agencies using Plumber. Some of them include SPF, MOM, MOE and MOH.',
  },
  // Add more FAQs as needed
]


export default function Example() {
  const { isOpen, onToggle } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, lg: true })

  return (
    <Box fontFamily="'DM Sans', sans-serif">

      <Box as="header" bg="white" position="relative" zIndex={10}>
        <Flex
          maxW="7xl"
          mx="auto"
          align="center"
          justify="space-between"
          px={{ base: 6, lg: 8, sm: 8 }}
          py={6}
        >
          <Flex flex="1">
            <Link href="#" isExternal _hover={{ textDecor: 'none' }}>
              <Image
                alt="Your Company"
                src={textlogo}
                h="6"
              />
            </Link>
          </Flex>

          {!isDesktop && (
            <IconButton
              aria-label="Open menu"
              icon={isOpen ? <BiX /> : <BiMenu />}
              variant="clear"
              onClick={onToggle}
            />
          )}

          {isDesktop && (
            <>
              <HStack spacing={12}>
                <Popover trigger="hover" placement="bottom-start">
                  <PopoverTrigger>
                    <Button variant="clear" rightIcon={<BiChevronDown />} fontWeight="medium">
                      Use cases
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent px='16px' py='16px' w="sm">
                    <Stack spacing='16px'>
                      {products.map((item) => (
                        <RouterLink key={item.name} to={item.to} style={{ textDecoration: 'none' }}>
                          <HStack
                            key={item.name}
                            spacing={4}
                            align="center"
                            px='12px'
                            py='14px'
                            _hover={{ bg: 'grey.100', borderRadius: '4px', px: '12px', py: '14px' }}

                          >
                            <Box
                              as="span"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              w={12}
                              h={12}
                              borderRadius="8px"
                              bg="grey.50"
                            >
                              <Icon as={item.icon} boxSize={7} color="gray.600" />
                            </Box>
                            <Box>
                              <Text fontSize="md" color="gray.900">
                                {item.name}
                              </Text>
                              <Text fontSize="sm" color="gray.600">
                                {item.description}
                              </Text>
                            </Box>
                          </HStack>
                        </RouterLink>
                      ))}
                    </Stack>
                  </PopoverContent>
                </Popover>

                <Button as="a" href="/Landing/usecases" variant="clear">
                  Releases
                </Button>
              </HStack>
              <Flex flex="1" justify="flex-end">
                <Button
                  as="a"
                  href="https://www.plumber.gov.sg"
                  variant="clear"
                >
                  Log in
                </Button>
              </Flex>
            </>
          )}
        </Flex>

        {/* Mobile Menu */}
        <Collapse in={isOpen} animateOpacity>
          <Box bg="white" shadow="md" px={{ base: 6, sm: 8 }} pt={6} pb={8}>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Use cases
                </Text>
                <VStack align="start" spacing={4}>
                  {[...products].map((item) => (
                    <Box>
                      <Text fontSize="md" color="gray.900">
                        {item.name}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {item.description}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
              <Link href="#" fontWeight="medium" pt={2} textDecoration="none">
                Releases
              </Link>
              <Link href="#" fontWeight="medium" pt={2} textDecoration="none">
                Log in
              </Link>
            </VStack>
          </Box>
        </Collapse>

        {/* Hero section */}
        <Box position="relative" overflow="hidden">
          {/* SVG Pattern Background */}
          <Box
            as="svg"
            position="fixed"
            inset="0"
            zIndex="-2"
            width="100%"
            height="100%"
            stroke="gray.200"
            aria-hidden="true"
            __css={{
              maskImage: 'radial-gradient(100% 100% at top right, white, transparent)',
              WebkitMaskImage: 'radial-gradient(100% 100% at top right, white, transparent)', // Safari fallback
            }}
          >
            <defs>
              <pattern
                id="0787a7c5-978c-4f66-83c7-11c213f99cb7"
                x="50%"
                y="-1"
                width="200"
                height="200"
                patternUnits="userSpaceOnUse"
              >
                <path d="M.5 200V.5H200" fill="none" />
              </pattern>
            </defs>
            <chakra.rect
              fill="url(#0787a7c5-978c-4f66-83c7-11c213f99cb7)"
              width="100%"
              height="100%"
              strokeWidth={0}
            />
          </Box>

          {/* Content */}
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            maxW="7xl"
            mx="auto"
            px={{ base: 6, lg: 8 }}
            pt={{ base: 0, lg: 20 }}
            pb={{ base: 24, sm: 32, lg: 40 }}
          // align="center"
          >
            {/* Left Column */}
            <Box maxW="xl" mx="auto" pt={{ lg: 8 }} flexShrink={0} alignContent='center'>
              <Heading
                as="h1"
                mt={10}
                fontSize={{ base: '4xl', sm: '7xl', lg: '56px' }}
                fontWeight="500"
                color="gray.900"
                fontStyle="regular"
                letterSpacing="tighter"
              >
                The easiest no-code automation tool for public service
              </Heading>

              <Text mt={4} fontSize={{ base: 'md', sm: 'xl', lg: '2xl' }} fontWeight="400" color="gray.500" letterSpacing="tight">
                Automate manual processes in hours, not weeks
              </Text>

              <Stack direction="row" spacing={6} mt={10} align="center">
                <Button
                  as="a"
                  href="https://plumber.gov.sg"
                  bg="primary.100"
                  color="primary.500"
                  borderColor="primary.100"
                  px={4}
                  py={2.5}
                  fontSize="md"
                  fontWeight="medium"
                  _hover={{ bg: 'primary.200', color: "primary.600" }}
                  _focusVisible={{ outline: '2px solid', outlineOffset: '2px', outlineColor: 'primary.500' }}
                  shadow="xs"
                >
                  Get started
                </Button>
                <Link 
                  href="use-cases" 
                  fontSize="md" 
                  fontWeight="500" 
                  color="gray.900" 
                  textDecoration='none' 
                  _hover={{ textDecoration: 'none' }} 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('use-cases')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}>
                  See use cases
                </Link>
              </Stack>
            </Box>

            {/* Right Column - Image */}
            <Box
              mx="auto"
              mt={{ base: 16, sm: 24, lg: 0 }}
              ml={{ lg: 10, xl: 32 }}
              maxW={{ base: '2xl', lg: 'none' }}
              flex="none"
            >
              <Box
                maxW={{ base: '3xl', sm: '5xl', lg: 'none' }}
                flex="none"
                borderRadius="16px"
                overflow="hidden" >
                <Lottie
                  animationData={HeroLottie}
                  loop
                  autoplay
                  style={{ width: 'auto', height: 'auto' }}
                />
              </Box>
            </Box>
          </Flex>
        </Box>

        {/*Logo section */}
        <Box bg="white" py={{ base: 24, sm: 32 }}>
          <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
            <SimpleGrid
              columns={{ base: 3, sm: 6, lg: 6 }}
              spacing={{ base: 8, sm: 10 }}
              spacingY={{ base: 12, sm: 14 }}
              maxW={{ base: "lg", sm: "xl", lg: "none" }}
              mx={{ base: "auto", lg: 0 }}
              alignItems="center"
            >
              <Image
                src={SpfLogo}
                alt="Singapore Police Force"
                width={158}
                height={48}
                colSpan={{ base: 2, lg: 1 }}
                maxH={24}
                w="full"
                objectFit="contain"
                objectFit="contain"
                filter="grayscale(100%) contrast(1.2) brightness(1.1)"
                opacity={0.7}
                transition="all 0.3s ease"
                _hover={{ filter: "grayscale(0%)", opacity: 1 }}
              />
              
              <Image
                src={GovTechLogo}
                alt="Government Technology Agency"
                width={158}
                height={48}
                colSpan={{ base: 2, lg: 1 }}
                maxH={24}
                w="full"
                objectFit="contain"
                objectFit="contain"
                filter="grayscale(100%)"
                opacity={0.7}
                transition="all 0.3s ease"
                _hover={{ filter: "grayscale(0%)", opacity: 1 }}
              />
              
              <Image
                src={MindefLogo}
                alt="Ministry of Defence"
                width={158}
                height={48}
                colSpan={{ base: 2, lg: 1 }}
                maxH={24}
                w="full"
                objectFit="contain"
                filter="grayscale(100%) contrast(1.2) brightness(1.1)"
                opacity={0.7}
                transition="all 0.3s ease"
                _hover={{ filter: "grayscale(0%)", opacity: 1 }}
              />
              
              <Box
                colSpan={{ base: 2, lg: 1 }}
                colStart={{ sm: 2, lg: "auto" }}
              >
                <Image
                  src={MoeLogo}
                  alt="Ministry of Education"
                  width={158}
                  height={48}
                  maxH={16}
                  w="full"
                  objectFit="contain"
                  filter="grayscale(100%) contrast(1.2) brightness(1.1)"
                  opacity={0.7}
                  transition="all 0.3s ease"
                  _hover={{ filter: "grayscale(0%)", opacity: 1 }}
                />
              </Box>
              
              <Box
                colSpan={{ base: 2, lg: 1 }}
                colStart={{ base: 2, sm: "auto" }}
              >
                <Image
                  src={MohLogo}
                  alt="Ministry of Health"
                  width={158}
                  height={48}
                  maxH={20}
                  w="full"
                  objectFit="contain"
                  filter="grayscale(100%) contrast(1.2) brightness(1.1)"
                  opacity={0.7}
                  transition="all 0.3s ease"
                  _hover={{ filter: "grayscale(0%)", opacity: 1 }}
                />
              </Box>

              <Box
                colSpan={{ base: 2, lg: 1 }}
                colStart={{ base: 2, sm: "auto" }}
              >
                <Image
                  src={MomLogo}
                  alt="Ministry of Manpower"
                  width={158}
                  height={48}
                  maxH={24}
                  w="full"
                  objectFit="contain"
                  filter="grayscale(100%) contrast(1.2) brightness(1.1)"
                  opacity={0.7}
                  transition="all 0.3s ease"
                  _hover={{ filter: "grayscale(0%)", opacity: 1 }}
                />
              </Box>
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
                <Text as="span" display={{ base: "none", md: "inline" }}>
                  Over 190 agencies use Plumber to automate their workflows.
                </Text>
                <Link
                  href="use-cases"
                  fontWeight="500"
                  color="primary.500"
                  textDecoration="none"
                  _hover={{ color: 'primary.600' }}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('use-cases')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}
                >
                  <Box position="absolute" inset={0} aria-hidden="true" />
                  {' '} Read use cases{' '}
                  <Text as="span" aria-hidden="true">
                    →
                  </Text>
                </Link>
              </Box>
            </Center>
          </Container>
        </Box>

        {/* Feature section 1 */}
        <Box bg="white" pt={{ base: 24, sm: 32 }} overflow="hidden">
          <Box mx="auto" maxW="6xl" textAlign={{ lg: "center", base: "center" }} px={{ base: '24px', sm: '24px' }}>
            <Heading
              fontSize={{ base: "4xl", sm: "5xl", lg: "48px" }}
              fontWeight="500"
              color="black"
              letterSpacing="tighter"
            >
              Built for government workflows
            </Heading>
            <Text mt={6} fontSize="xl" color="gray.500" mb={{ base: '60px', lg: '120px' }} letterSpacing="tight">
              Designed for public service use cases and users
            </Text>
          </Box>

          <Box maxW="7xl" mx="auto" px={{ base: 0, md: 6, lg: 8 }}>
            <Grid
              templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
              gapX={8}
              gapY={{ base: 16, sm: 20 }}
              alignItems="center"
            >
              {/* Left Side */}
              <Box px={{ base: 6, lg: 0 }} pt={{ lg: 4 }} pr={{ lg: 24 }}>
                <Box maxW="2xl" mx="auto" lg={{ mx: 0, maxW: 'lg' }}>
                <Heading
                  mt={2}
                  mb={8}
                  fontSize={{ base: '4xl', sm: '5xl', lg: '44px' }}
                  fontWeight="500"
                  color="gray.900"
                  letterSpacing="tighter"
                >
                  No code needed
                </Heading>

                  <Stack spacing={8} maxW={{ lg: "md", base: "2xl" }} color="gray.600" mb={10} >
                    {features1.map((feature) => (
                      <Box key={feature.name} pl={0} position="relative">
                        <Text as="dt" display="inline" fontWeight="semibold" color="primary.500">
                          {feature.name}
                        </Text>{' '}
                        <Text as="dd" display="inline">
                          {feature.description}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

              {/* Right Side - Image Section */}
              <Box px={{ base: '24px', lg: 0 }} >
                <Image
                  alt="Product screenshot"
                  src={NoCode}
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  width='100%'
                  height='100%'
                />
              </Box>
            </Grid>
          </Box>
        </Box>

        {/* Feature section 2 */}
        <Box bg="white" pt={{ base: 24, sm: 32 }} overflow="hidden">
          <Box maxW="7xl" mx="auto" px={{ base: 0, md: 6, lg: 8 }}>
            <Grid
              templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
              gapX={8}
              gapY={{ base: 16, sm: 20 }}
              alignItems="center"
            >
              {/* Right Side - Image Section */}
              <Box
                m='24px'
                px={{ lg: 0 }}
                mb='40px'
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius='16px'
                height='auto'
                width='auto'
                overflow='hidden'>
                <Lottie
                  animationData={Integrations}
                  loop
                  autoplay
                  style={{ width: 'auto', height: 'auto' }}
                />

              </Box>

              {/* left Side */}
              <Box px={{ base: 6, lg: '96px' }} pt={{ lg: 4 }} pr={{ lg: 24 }}>
                <Box maxW="2xl" mx="auto" lg={{ mx: 0, maxW: 'lg' }}>
                <Heading
                  mt={2}
                  mb={8}
                  fontSize={{ base: '4xl', sm: '5xl', lg: '44px' }}
                  fontWeight="500"
                  color="gray.900"
                  letterSpacing="tighter"
                >
                  Connect with tools you are familiar with
                </Heading>

                  <Stack spacing={8} maxW={{ lg: "xl", base: "2xl" }} color="gray.600" mb={10}>
                    {features2.map((feature) => (
                      <Box key={feature.name} pl={0} position="relative">
                        <Text as="dt" display="inline" fontWeight="semibold" color="primary.500">
                          {feature.name}
                        </Text>{' '}
                        <Text as="dd" display="inline">
                          {feature.description}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

            </Grid>
          </Box>
        </Box>

        {/* Use case feature */}
        <Box bg="white" py={{ base: 24, sm: 32 }} id="use-cases">
          <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
            <Box maxW={{ base: "2xl", lg: "4xl" }} mx="auto">
              <Heading
                fontSize={{ base: "4xl", sm: "5xl", lg: "48px" }}
                fontWeight="500"
                color="gray.900"
                lineHeight="tight"
                letterSpacing='tighter'
                textAlign='center'
              >
                <Text as="span" fontWeight="500" color="primary.500" fontSize={{ base: "4xl", sm: "5xl", lg: "48px" }}>Plumber</Text>
                {' '}in government
              </Heading>

              <Text mt={2} fontSize="lg" lineHeight="8" color="gray.500" letterSpacing='tight' textAlign='center'>
                Learn how others are automating their workflows
              </Text>

              <VStack
                mt={{ base: 16, lg: 20 }}
                spacing={{ base: 20, lg: 20 }}
                align="stretch"
              >
                {posts.map((post) => (
                  <Box
                    key={post.id}
                    as="article"
                    position="relative"
                    display="flex"
                    flexDirection={{ base: "column", lg: "row" }}
                    gap={8}
                  >
                    <Box
                      position="relative"
                      width={{ lg: "64" }}
                      flexShrink={{ lg: 0 }}
                    >
                      <AspectRatio
                        ratio={{ base: 16 / 9, sm: 2 / 1, lg: 1 }}
                      >
                        <Box position="relative">
                          <Image
                            src={post.imageUrl}
                            alt=""
                            position="absolute"
                            inset={0}
                            w="full"
                            h="full"
                            borderRadius="2xl"
                            bg="gray.50"
                            objectFit="cover"
                          />
                          <Box
                            position="absolute"
                            inset={0}
                            borderRadius="2xl"
                            border="1px solid"
                            borderColor="whiteAlpha.200"
                            opacity={0.1}
                          />
                        </Box>
                      </AspectRatio>
                    </Box>

                    <Box flex={1} alignContent='center'>
                      <HStack spacing={4} fontSize="m">
                        <Text color="gray.500">
                          {post.agency}
                        </Text>
                      </HStack>

                      <Box
                        position="relative"
                        maxW="xl"
                        role="group"
                        _hover={{ "& h3": { color: "gray.600" } }}
                      >
                        <Heading
                          as="h3"
                          mt={3}
                          fontSize="lg"
                          lineHeight="6"
                          fontWeight="500"
                          letterSpacing='tighter'
                          color="gray.900"
                          transition="color 0.2s"
                        >
                          <Link href={post.href} textDecoration="none" color='gray.900' _hover={{ textDecoration: 'none', color: 'primary.500' }}>
                            <Box position="absolute" inset={0} />
                            {post.title}
                          </Link>
                        </Heading>

                        <Text mt={5} fontSize="sm" lineHeight="6" color="gray.600">
                          {post.description}
                        </Text>
                      </Box>

                    </Box>
                  </Box>
                ))}
              </VStack>
            </Box>
          </Container>
        </Box>

        {/* FAQ section */}
        <Box bg="white" py={{ base: 24, sm: 32, lg: 30 }}>
          <Container maxW="7xl" px={{ base: 6, lg: 8, sm: 8 }}>
            <Box maxW="4xl" mx="auto">
              <Heading
                fontSize={{ base: '4xl', sm: '5xl', lg: '48px' }}
                fontWeight="500"
                color="gray.900"
                textAlign="center"
                letterSpacing="tighter"
              >
                Got a question for us?
              </Heading>

              <Accordion mt={16} allowMultiple>
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={faq.question}
                    py={6}
                    borderTop={index === 0 ? 'none' : '1px solid'}
                    borderBottom={index === faqs.length - 1 ? 'none' : '1px solid'}
                    borderColor={index === 0 && index === faqs.length - 1 ? 'transparent' : 'gray.100'}
                    _hover={{ bg: 'transparent' }}

                  >
                    <h3>
                      <AccordionButton
                        px={0}
                        _expanded={{ fontWeight: 'medium' }}
                        justifyContent="space-between"
                        textAlign="left"
                        _hover={{ bg: 'transparent' }}
                      >
                        <Box as="span" fontSize="base" flex="1" textAlign="left">
                          {faq.question}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h3>
                    <AccordionPanel mt={2} pr={12} px={0}>
                      <Text fontSize="base" color="gray.600">
                        {faq.answer}
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </Box>
          </Container>
        </Box>




      </Box>

    </Box>

  );
}