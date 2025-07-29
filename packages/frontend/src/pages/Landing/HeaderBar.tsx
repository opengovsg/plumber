import { BiMenu, BiX } from 'react-icons/bi'
import {
  Box,
  Collapse,
  Flex,
  HStack,
  Image,
  Link,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'

import textlogo from '@/assets/landing/textlogo.svg'
import * as URLS from '@/config/urls'

// TODO: add more when we have more than 1 use case
// const USE_CASES = [
//   {
//     name: 'Human Resource',
//     description: 'Streamline onboarding and offboarding',
//     to: URLS.HUMAN_RESOURCE,
//     icon: BiGroup,
//   },
// ]

export default function HeaderBar() {
  const { isOpen, onToggle } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, lg: true })
  return (
    <>
      <Flex
        maxW="7xl"
        mx="auto"
        align="center"
        justify="space-between"
        px={{ base: 6, lg: 8, sm: 8 }}
        py={6}
      >
        <Flex flex="1">
          <Link href={URLS.ROOT} _hover={{ textDecor: 'none' }}>
            <Image alt="Plumber" src={textlogo} />
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
            <HStack spacing={8}>
              {/* <Popover trigger="hover" placement="bottom-start">
                <PopoverTrigger>
                  <Button
                    variant="clear"
                    rightIcon={<BiChevronDown />}
                    fontWeight="medium"
                  >
                    Use cases
                  </Button>
                </PopoverTrigger>
                <PopoverContent px="16px" py="16px" w="sm">
                  <Stack spacing="16px">
                    {USE_CASES.map((item) => (
                      <Link
                        key={item.name}
                        href={item.to}
                        style={{ textDecoration: 'none' }}
                        w="full"
                      >
                        <HStack
                          key={item.name}
                          spacing={4}
                          align="center"
                          px="12px"
                          py="14px"
                          _hover={{
                            bg: 'grey.100',
                            borderRadius: '4px',
                            px: '12px',
                            py: '14px',
                          }}
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
                      </Link>
                    ))}
                  </Stack>
                </PopoverContent>
              </Popover> */}

              {/* TODO: check if this link needs to be changed */}
              <Button
                as="a"
                href={URLS.GUIDE_LINK}
                target="_blank"
                variant="clear"
              >
                Releases
              </Button>

              <Button
                as="a"
                href={URLS.STATUS_LINK}
                target="_blank"
                variant="clear"
              >
                Status
              </Button>
            </HStack>
            <Flex flex="1" justify="flex-end">
              <Button as="a" href={URLS.LOGIN} variant="clear">
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
              {/* <VStack align="start" spacing={4}>
                {USE_CASES.map((item) => (
                  <Box
                    key={item.name}
                    as="a"
                    href={item.to}
                    _hover={{ textDecoration: 'underline' }}
                  >
                    <Text fontSize="md" color="gray.900">
                      {item.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {item.description}
                    </Text>
                  </Box>
                ))}
              </VStack> */}
            </Box>
            <Link
              href={URLS.GUIDE_LINK}
              fontWeight="medium"
              pt={2}
              textDecoration="none"
            >
              Releases
            </Link>
            <Link
              href={URLS.STATUS_LINK}
              target="_blank"
              fontWeight="medium"
              pt={2}
              textDecoration="none"
            >
              Status
            </Link>
            <Link
              href={URLS.LOGIN}
              fontWeight="medium"
              pt={2}
              textDecoration="none"
            >
              Log in
            </Link>
          </VStack>
        </Box>
      </Collapse>
    </>
  )
}
