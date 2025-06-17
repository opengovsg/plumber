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
} from '@chakra-ui/react'
import { BiChevronRight, BiChevronDown, BiGroup, BiSupport, BiCog, BiMenu, BiX } from 'react-icons/bi'
import HeroImg from '@/assets/landing/HeroImg.svg'
import Integrations from '@/assets/landing/Integrations.svg'
import textlogo from '@/assets/landing/textlogo.svg'
import { Link as RouterLink } from 'react-router-dom'



const products = [
  { name: 'Human Resource', description: 'Streamline onboarding and offboarding', to: 'https://www.plumber.gov.sg', icon: BiGroup },
  { name: 'Operations', 
    description: 'Monitor on the ground movement', 
    to: 'Landing/UseCases/HumanResource', 
    icon: BiCog },
  { name: 'Customer support', description: 'Respond to tickets efficiently', to: '#', icon: BiSupport },
]

const features1 = [
  {
    name: 'Click to set up',
    description:
      'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.',
    icon: BiMenu,
  },
  {
    name: 'Templates',
    description: 'Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.',
    icon: BiMenu,
  },
]

const features2 = [
  {
    name: 'WOG apps',
    description:
      'things like formsg',
    icon: BiMenu,
  },
  {
    name: 'Other apps',
    description: 'things like telegram',
    icon: BiMenu,
  },
]

const faqs = [
  {
    question: 'Is Plumber free?',
    answer: 'ya u just login and see la',
  },
  {
    question: 'Do you offer technical support?',
    answer: 'Yes, Jackson will sit with you 24/7.',
  },
  {
    question: 'Which agencies are using Plumber?',
    answer: 'You huan lo. we believe in pioneering solutions so be an early adopter.',
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
        px={{ base: 8, lg: 8 }}
        py={6}
      >
        <Flex flex="1">
        <Link href="https://www.plumber.gov.sg" isExternal _hover={{ textDecor: 'none' }}>
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
                <PopoverContent px='16px' py='16px' w="md">
                  <Stack spacing='24px'>
                    {products.map((item) => (
                    <RouterLink key={item.name} to={item.to} style={{ textDecoration: 'none' }}>
                      <HStack 
                      key={item.name} 
                      // as="a"
                      // href={item.to}
                      spacing={4} 
                      align="center"  
                      px='12px'   
                      py='14px'     
                      _hover={{ bg: 'grey.100', borderRadius: '4px' , px: '12px', py:'14px'}}

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
                          {/* <Link href={item.href} fontWeight="medium" color="gray.900">
                            {item.name}
                          </Link> */}
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

              
              {/* <Link href="#" fontWeight="semibold" color="gray.900">
                Marketplace
              </Link>
              <Link href="#" fontWeight="semibold" color="gray.900">
                Company
              </Link> */}
              <Button as="a" href="/Landing/usecases" variant="clear">
                Releases
              </Button>
            </HStack>
            <Flex flex="1" justify="flex-end">
              {/* <Link href="https://www.plumber.gov.sg/login" fontWeight="medium" color="gray.900">
                Log in →
              </Link> */}
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
        <Box bg="white" shadow="md" px={4} pt={6} pb={8}>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="semibold" mb={2}>
                Use cases
              </Text>
              <VStack align="start" spacing={4}>
                {[...products].map((item) => (
                  <Box>
                  {/* <Link href={item.href} fontWeight="medium" color="gray.900">
                    {item.name}
                  </Link> */}
                  <Text fontSize="md" color="gray.900">
                    {item.name}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {item.description}
                  </Text>
                </Box>
                  // <Link key={item.name} href={item.href} color="gray.900" fontWeight="medium">
                  //   {item.name}
                  // </Link>
                ))}
              </VStack>
            </Box>
            <Link href="#" fontWeight="medium" pt={2} borderTop="1px" borderColor="gray.100" color="" textDecoration="none" _hover={{ textDecoration: 'none' }}>
              Releases
            </Link>
              <Link href="#" fontWeight="medium" pt={2} borderTop="1px" borderColor="gray.100" textDecoration="none" _hover={{ textDecoration: 'none' }}>
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
    stroke="primary.100"
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
    pt={{ base: 0, lg: 20}}
    pb={{ base: 24, sm: 32, lg: 40 }}
  >
    {/* Left Column */}
    <Box maxW="2xl" mx="auto" pt={{ lg: 8 }} flexShrink={0}>
      <Box mt={{ base: 24, sm: 32, lg: 16 }}>
          <Button
            variant='outline'
            px='12px'
            py='6px'
            fontSize="md"
            fontWeight="medium"
            color="primary.500"
            bg="clear"
            borderRadius="full"
            border="1px solid"
            borderColor="primary.500"
          >
            What's new
          </Button>
          {/* <Flex align="center" gap={2} fontSize="sm" fontWeight="medium" color="gray.600">
            <span>Just shipped v1.0</span>
            <BiChevronRight boxSize={5} color="gray.400" />
          </Flex> */}
      </Box>

      <Heading
        as="h1"
        mt={10}
        fontSize={{ base: '4xl', sm: '7xl' }}
        fontWeight="500"
        color="gray.900"
        fontStyle="regular"
        letterSpacing="tighter"
        // lineHeight="shorter"
      >
        Empowering Singapore's public service with no-code automations
      </Heading>

      <Text mt={4} fontSize={{ base: 'md', sm: 'xl' }} fontWeight="400" color="gray.500">
        Transform manual processes into automated workflows without any code
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
          fontSize="sm"
          fontWeight="medium"
          _hover={{ bg: 'primary.200' }}
          _focusVisible={{ outline: '2px solid', outlineOffset: '2px', outlineColor: 'primary.500' }}
          shadow="xs"
        >
          Get started
        </Button>
        <Link href="#" fontSize="sm" fontWeight="semibold" color="gray.900" textDecoration='none' _hover={{ textDecoration: 'none' }}>
          Learn more
        </Link>
      </Stack>
    </Box>

    {/* Right Column - Image */}
    <Box
      mx="auto"
      mt={{ base: 16, sm: 24, lg: 0 }}
      mr={{ lg: 0 }}
      ml={{ lg: 10, xl: 32 }}
      maxW={{ base: '2xl', lg: 'none' }}
      flex="none"
    >
      <Box maxW={{ base: '3xl', sm: '5xl', lg: 'none' }} flex="none">
        <Box
          m={{ base: -2, lg: -4 }}
          borderRadius={{ base: 'xl', lg: '2xl' }}
          bg="rgba(17, 24, 39, 0.05)" // Equivalent to gray.900 @ 5% opacity
          p={{ base: 2, lg: 4 }}
          border="1px"
          borderColor="rgba(17, 24, 39, 0.1)"
        >
          <Image
            alt="App screenshot"
            src={HeroImg} // assuming you imported HeroImg from your assets folder
            width="full"
            height="full"
            borderRadius="md"
            boxShadow="2xl"
            border="1px solid"
            borderColor="rgba(17, 24, 39, 0.1)"
          />
        </Box>
      </Box>
    </Box>
  </Flex>
      </Box>

      {/* Feature section 1 */}
      <Box bg="white" pt={{ base: 24, sm: 32 }} overflow="hidden" pb={{ base: 0, sm: 32 }}>
        <Box mx="auto" maxW="6xl" textAlign={{ lg: "center", base: "center"}} px={{ base: 8, sm: 32 }}>
          {/* <Text fontSize="sm" fontWeight="semibold" color="red">
            Anyone can build
          </Text> */}
          <Heading
            mt={2}
            fontSize={{ base: "4xl", sm: "5xl" }}
            fontWeight="500"
            color="black"
            letterSpacing="tighter"
            textWrap="balance" // Chakra v2 supports this prop
          >
            Build automations without a single line of code
          </Heading>
          <Text mt={6} fontSize="lg" lineHeight="2" color="gray.500" mb="120px">
            Plumber believes in no code
          </Text>
        </Box>
      <Box maxW="7xl" mx="auto" px={{ base: 2, md: 6, lg: 8 }}>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gapX={8}
          gapY={{ base: 16, sm: 20 }}
          alignItems="center"
        >
          {/* Left Side */}
          <Box px={{ base: 6, lg: 0 }} pt={{ lg: 4 }} pr={{ lg: 24 }}>
            <Box maxW="2xl" mx="auto" lg={{ mx: 0, maxW: 'lg' }}>
              {/* <Text fontSize="sm" fontWeight="semibold" color="indigo.600">
                Deploy faster
              </Text>
              <Heading
                mt={2}
                fontSize={{ base: '4xl', sm: '5xl' }}
                fontWeight="semibold"
                color="gray.900"
              >
                A better workflow
              </Heading>
              <Text mt={6} fontSize="lg" color="gray.600">
                Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque,
                iste dolor cupiditate blanditiis ratione.
              </Text> */}

              <Stack mt={0} spacing={8} maxW= {{lg:"xl", base:"2xl"}} color="gray.600" mb={10} >
                {features1.map((feature) => (
                  <Box key={feature.name} pl={9} position="relative">
                    <Icon
                      as={feature.icon}
                      boxSize={5}
                      color="indigo.600"
                      position="absolute"
                      top={1}
                      left={1}
                    />
                    <Text as="dt" display="inline" fontWeight="semibold" color="gray.900">
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
          <Box px={{ base: 8, lg: 0 }}>
            <Box
              position="relative"
              overflow="hidden"
              bg="primary.100"
              pl={12}
              pr={0}
              pt={useBreakpointValue({ base: 8, sm: 16, lg: 16 })}
              borderRadius={{ sm: '3xl', base:'2xl' }}
            >
              {/* <Box
                position="absolute"
                top="-1px"
                left="-3"
                zIndex={-1}
                w="full"
                h="full"
                transform="skewX(-30deg)"
                bg="primary.100"
                opacity={0.2}
                border="1px"

              /> */}
              {/* <Box 
                position="relative" 
                zIndex={1} 
                maxW="2xl" 
                mx="auto"
                // display="flex"
                // justifyContent="flex-start"
                // alignItems="flex-end"
                minH={{ base: '400px', md: '480px' }}
                borderColor="red"
              > */}
                <Image
                  alt="Product screenshot"
                  src={Integrations}
                  width={2432}
                  height="480px"
                  borderTopLeftRadius="xl"
                  // bg="primary.500"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  objectFit="cover"
                />
              {/* </Box> */}
              <Box
                pointerEvents="none"
                position="absolute"
                inset="0"
                border="1px solid"
                borderColor="blackAlpha.100"
                borderRadius={{ sm: '3xl' }}
              />
            </Box>
          </Box>
        </Grid>
      </Box>
      </Box>
      
      {/* Feature section 2 */}
      <Box bg="white" pt={{ base: 24, sm: 32 }} overflow="hidden" pb={{ base: 0, sm: 32 }}>
        <Box mx="auto" maxW="6xl" textAlign={{ lg: "center", base: "center"}} px={{ base: 8, sm: 32 }}>
          {/* <Text fontSize="sm" fontWeight="semibold" color="red">
            Anyone can build
          </Text> */}
          <Heading
            mt={2}
            fontSize={{ base: "4xl", sm: "5xl" }}
            fontWeight="500"
            color="black"
            letterSpacing="tighter"
            textWrap="balance" // Chakra v2 supports this prop
          >
            Build automations without a single line of code
          </Heading>
          <Text mt={6} fontSize="lg" lineHeight="2" color="gray.500" mb="120px">
            Plumber believes in no code
          </Text>
        </Box>
      <Box maxW="7xl" mx="auto" px={{ base: 2, md: 6, lg: 8 }}>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gapX={8}
          gapY={{ base: 16, sm: 20 }}
          alignItems="center"
        >

          {/* Right Side - Image Section */}
          <Box px={{ base: 8, lg: 0 }}>
            <Box
              position="relative"
              overflow="hidden"
              bg="primary.100"
              pl={12}
              pr={0}
              pt={useBreakpointValue({ base: 8, sm: 16, lg: 16 })}
              borderRadius={{ sm: '3xl', base:'2xl' }}
            >
              {/* <Box
                position="absolute"
                top="-1px"
                left="-3"
                zIndex={-1}
                w="full"
                h="full"
                transform="skewX(-30deg)"
                bg="primary.100"
                opacity={0.2}
                border="1px"

              /> */}
              {/* <Box 
                position="relative" 
                zIndex={1} 
                maxW="2xl" 
                mx="auto"
                // display="flex"
                // justifyContent="flex-start"
                // alignItems="flex-end"
                minH={{ base: '400px', md: '480px' }}
                borderColor="red"
              > */}
            <Image
                  alt="Product screenshot"
                  src={Integrations}
                  width={2432}
                  height="480px"
                  borderTopLeftRadius="xl"
                  // bg="primary.500"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  objectFit="cover"
             />
              {/* </Box> */}
            <Box
                pointerEvents="none"
                position="absolute"
                inset="0"
                border="1px solid"
                borderColor="blackAlpha.100"
                borderRadius={{ sm: '3xl' }}
            />
            </Box>
          </Box>

          {/* Left Side */}
          <Box px={{ base: 6, lg: 0 }} pt={{ lg: 4 }} pr={{ lg: 24 }}>
            <Box maxW="2xl" mx="auto" lg={{ mx: 0, maxW: 'lg' }}>
              {/* <Text fontSize="sm" fontWeight="semibold" color="indigo.600">
                Deploy faster
              </Text>
              <Heading
                mt={2}
                fontSize={{ base: '4xl', sm: '5xl' }}
                fontWeight="semibold"
                color="gray.900"
              >
                A better workflow
              </Heading>
              <Text mt={6} fontSize="lg" color="gray.600">
                Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque,
                iste dolor cupiditate blanditiis ratione.
              </Text> */}

              <Stack mt='44px' spacing={8} maxW= {{lg:"xl", base:"2xl"}} color="gray.600" mb={10} ml= {{ base: '0px', lg:'96px' }}>
                {features2.map((feature) => (
                  <Box key={feature.name} pl={9} position="relative">
                    <Icon
                      as={feature.icon}
                      boxSize={5}
                      color="indigo.600"
                      position="absolute"
                      top={1}
                      left={1}
                    />
                    <Text as="dt" display="inline" fontWeight="semibold" color="gray.900">
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

      {/* FAQ section */}
      <Box bg="white" py={{ base: 24, sm: 32, lg: 40 }}>
      <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
        <Box maxW="4xl" mx="auto">
          <Heading
            as="h2"
            fontSize={{ base: '4xl', sm: '5xl' }}
            fontWeight="500"
            color="gray.900"
            textAlign="left"
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