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
        to: 'humanresource', 
        icon: BiGroup },
    { name: 'Operations', 
      description: 'Monitor on the ground movement', 
      to: '#', 
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
  
          <Box bg="clear" px={6} py={32} minH="100vh">
        <Container maxW="3xl" color="gray.700" fontSize="md" lineHeight="7">
          <Text fontSize="md" fontWeight="semibold" color="primary.500" lineHeight="7">
            Operations
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
            How agency uses Plumber to accelerate human resource work
          </Heading>
          
          <Text mt={6} fontSize="xl" lineHeight="8">
            Aliquet nec orci mattis amet quisque ullamcorper neque, nibh sem. At arcu, sit dui mi, nibh dui, diam eget
            aliquam. Quisque id at vitae feugiat egestas ac. Diam nulla orci at in viverra scelerisque eget. Eleifend
            egestas fringilla sapien.
          </Text>
          
          <Box mt={10} maxW="2xl">
            <Text>
              Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae
              sed turpis id. Id dolor praesent donec est. Odio penatibus risus viverra tellus varius sit neque erat velit.
              Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae
              sed turpis id.
            </Text>
            
            <List mt={8} maxW="xl" spacing={8} color="gray.600">
              <ListItem display="flex" gap={3}>
                <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
                <Box>
                  <Text as="span" fontWeight="semibold" color="gray.900">Data types.</Text>
                  {' '}Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.
                </Box>
              </ListItem>
              
              <ListItem display="flex" gap={3}>
                <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
                <Box>
                  <Text as="span" fontWeight="semibold" color="gray.900">Loops.</Text>
                  {' '}Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.
                </Box>
              </ListItem>
              
              <ListItem display="flex" gap={3}>
                <ListIcon as={BiSolidCheckCircle} mt={1} boxSize={5} color="primary.500" flexShrink={0} />
                <Box>
                  <Text as="span" fontWeight="semibold" color="gray.900">Events.</Text>
                  {' '}Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus. Et magna sit morbi lobortis.
                </Box>
              </ListItem>
            </List>
            
            <Text mt={8}>
              Et vitae blandit facilisi magna lacus commodo. Vitae sapien duis odio id et. Id blandit molestie auctor
              fermentum dignissim. Lacus diam tincidunt ac cursus in vel. Mauris varius vulputate et ultrices hac
              adipiscing egestas. Iaculis convallis ac tempor et ut. Ac lorem vel integer orci.
            </Text>
            
            <Heading 
              as="h2" 
              mt={16} 
              fontSize="3xl" 
              fontWeight="500" 
              color="gray.900"
              lineHeight="normal"
              letterSpacing="tighter"
            >
              From beginner to expert in 3 hours
            </Heading>
            
            <Text mt={6}>
              Id orci tellus laoreet id ac. Dolor, aenean leo, ac etiam consequat in. Convallis arcu ipsum urna nibh.
              Pharetra, euismod vitae interdum mauris enim, consequat vulputate nibh. Maecenas pellentesque id sed tellus
              mauris, ultrices mauris. Tincidunt enim cursus ridiculus mi. Pellentesque nam sed nullam sed diam turpis
              ipsum eu a sed convallis diam.
            </Text>
            
            <Box as="figure" mt={10} borderLeft="4px" borderColor="primary.500" pl={9}>
              <Box as="blockquote" fontWeight="400" color="gray.900">
                <Text>
                  "Vel ultricies morbi odio facilisi ultrices accumsan donec lacus purus. Lectus nibh ullamcorper ac
                  dictum justo in euismod. Risus aenean ut elit massa. In amet aliquet eget cras. Sem volutpat enim
                  tristique."
                </Text>
              </Box>
              
              <HStack as="figcaption" mt={6} spacing={4}>
                <Avatar
                  size="sm"
                  src="https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  bg="gray.50"
                />
                <Box fontSize="sm" lineHeight={6}>
                  <Text as="span" fontWeight="semibold" color="gray.900">Maria Hill</Text>
                  <Text as="span" color="gray.600"> – Marketing Manager</Text>
                </Box>
              </HStack>
            </Box>
            
            <Text mt={10}>
              Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae
              sed turpis id. Id dolor praesent donec est. Odio penatibus risus viverra tellus varius sit neque erat velit.
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
              <Icon as={BiSolidCheckCircle} mt={0.5} boxSize={5} color="gray.300" flexShrink={0} />
              <Text>Faucibus commodo massa rhoncus, volutpat.</Text>
            </HStack>
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
              Everything you need to get up and running
            </Heading>
            
            <Text mt={6}>
              Purus morbi dignissim senectus mattis adipiscing. Amet, massa quam varius orci dapibus volutpat cras. In
              amet eu ridiculus leo sodales cursus tristique. Tincidunt sed tempus ut viverra ridiculus non molestie.
              Gravida quis fringilla amet eget dui tempor dignissim. Facilisis auctor venenatis varius nunc, congue erat
              ac. Cras fermentum convallis quam.
            </Text>
            
            <Text mt={8}>
              Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae
              sed turpis id. Id dolor praesent donec est. Odio penatibus risus viverra tellus varius sit neque erat velit.
            </Text>
          </Box>
        </Container>
      </Box>
  
          </Box>
  
  
  
  
        </Box>
      );
    }