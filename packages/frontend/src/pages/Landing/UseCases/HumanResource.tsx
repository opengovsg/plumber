import {
  Box,
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
  chakra,
  Heading,
  Container,
  List,
  ListItem,
  ListIcon,
  Avatar,
}from '@chakra-ui/react'

import { BiChevronDown, BiGroup, BiSupport, BiCog, BiMenu, BiX, BiSolidCheckCircle } from 'react-icons/bi'
import textlogo from '@/assets/landing/textlogo.svg'
import { Link as RouterLink } from 'react-router-dom'

const products = [
  { name: 'Human Resource', 
      description: 'Streamline onboarding and offboarding', 
      to: 'Landing/UseCases/HumanResource', 
      icon: BiGroup },
  { name: 'Operations', 
    description: 'Monitor on the ground movement', 
    to: 'Landing/UseCases/Operations', 
    icon: BiCog },
  { name: 'Customer support', description: 'Respond to tickets efficiently', to: '#', icon: BiSupport },
]

export default function UseCasesPage() {
  const { isOpen, onToggle } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, lg: true })
    return (
      <Box fontFamily="'DM Sans', sans-serif">

        {/* Header */}
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



        </Box>

        {/* Content */}
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

        <Box px={3} pt={8} pb={32} minH="100vh">
        <Container maxW="3xl" color="gray.700" fontSize="md" lineHeight="7">
        <Text fontSize="md" fontWeight="semibold" color="primary.500" lineHeight="7" letterSpacing='tighter'>
          Human Resource
        </Text>
        
        <Heading 
          as="h1" 
          mt={2} 
          fontSize={{ base: "4xl", sm: "5xl" }} 
          fontWeight="500" 
          letterSpacing="tighter"
          color="gray.900"
          lineHeight="normal"
        >
          How Attorney General's Chamber reduced 50% of time spent on administrative onboarding processes
        </Heading>
        
        <Text mt={6} fontSize="xl" lineHeight="8" letterSpacing='tighter'>
          Onboarding used to take 2 hours for each new employee, with lots of errors in the process of it.
        </Text>
        
        <Box mt={10} maxW="2xl">
          <Text>
            With Plumber,
          </Text>
          
          <List mt={8} maxW="xl" spacing={4} color="gray.600">
            <ListItem display="flex" gap={3}>
              <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
              <Box>
                <Text as="span" fontWeight="semibold" color="gray.900">50% time saved</Text>
                {' '}to onboard new employee
              </Box>
            </ListItem>
            
            <ListItem display="flex" gap={3}>
              <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
              <Box>
                <Text as="span" fontWeight="semibold" color="gray.900">95% reduction</Text>
                {' '}in errors by automating
              </Box>
            </ListItem>
            
            <ListItem display="flex" gap={3}>
              <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
              <Box>
                <Text as="span" fontWeight="semibold" color="gray.900">Able to focus on more important work</Text>
                {' '}like strategy after automating process
              </Box>
            </ListItem>
          </List>
          
          <Box mt={16} maxW="2xl">
          <Heading 
            as="h2" 
            fontSize="3xl" 
            fontWeight="500" 
            color="gray.900"
            lineHeight="normal"
            letterSpacing="tighter"
          >
            Life before Plumber
          </Heading>
          
          <Text mt={6}>
            Before a new employees' first day, HR will manually send an email containing administrative details and an attached form for employees' to submit their documents.
            When employees have submitted via replying the email, HR will review the information and manually forward it to relevant departments. For example, forwarding to
            a department that makes access cards for new employees'.
          </Text>
          
          <Text mt={8}>
            There were many problems with this process. For example, an employee may forget to copy HR back in to the email thread, leaving them out of the loop and delaying the onboarding preparation.
          </Text>
        </Box>

        <Box mt={16} maxW="2xl">
          <Heading 
            as="h2" 
            fontSize="3xl" 
            fontWeight="500" 
            color="gray.900"
            lineHeight="normal"
            letterSpacing="tighter"
          >
            Paving the way for transformation
          </Heading>
          
          <Text mt={6}>
            Zhi Hao, a HR staff in AGC, relooked at their processes and identified parts of the process that could easily be automated. He started small and slowly
            expanded the scope. 
          </Text>
          
          <Text mt={8}>
            Aumtomating the entire process took him approximately 3 months. This includes piloting this solution with his team to convince them of the value. 
          </Text>
        </Box>
          
          <Heading 
            as="h2" 
            mt={16} 
            fontSize="3xl" 
            fontWeight="500" 
            color="gray.900"
            lineHeight="normal"
            letterSpacing="tighter"
          >
            A better HR experience for all
          </Heading>
          
          <Text mt={6}>
            As of today, 200 over employees have been onboarded in the 3 months this process has been automated. This amounts to time savings of over 200 hours. The 
            time saved has gone into working on other more strategic objectives of the department such as, making people happy.
          </Text>
          
          <Box as="figure" mt={10} borderLeft="4px" borderColor="primary.500" pl={9}>
            <Box as="blockquote" fontWeight="400" color="gray.900">
              <Text>
                "Be ready to conduct constant review. This process is inevitable as stakeholders will comment for process improvement. Be ready to make evaluation and amendments appropriately.
                "
              </Text>
            </Box>
            
            <HStack as="figcaption" mt={6} spacing={4}>
              {/* <Avatar
                size="sm"
                src="https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                bg="gray.50"
              /> */}
              <Box fontSize="sm" lineHeight={6}>
                <Text as="span" fontWeight="semibold" color="gray.900">Zhi Hao</Text>
                <Text as="span" color="gray.600"> – HR department</Text>
              </Box>
            </HStack>
          </Box>
          
          <Text mt={10}>
            The team is looking to fully move over to this newly automated process by the end of this month.
          </Text>
        </Box>
        
        <Box as="figure" mt={16}>
          <Image
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&w=1310&h=873&q=80&facepad=3"
            alt=""
            aspectRatio={16/9}
            borderRadius="xl"
            bg="gray.50"
            objectFit="cover"
            w="full"
          />
          <HStack as="figcaption" mt={4} spacing={2} fontSize="sm" lineHeight={6} color="gray.500">
            <Text>Happy HR staff</Text>
          </HStack>
        </Box>
        
        </Container>
        </Box>

        </Box>




      </Box>
    );
  }