import { useRef } from 'react'
import { BiSad } from 'react-icons/bi'
import {
  Box,
  Flex,
  Heading,
  Icon,
  Link,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { SGID_CHECK_ELIGIBILITY_URL } from '@/config/urls'

export default function SgidFailureModal(): JSX.Element {
  // One off modal, so store state directly.
  const { isOpen, onClose } = useDisclosure({ defaultIsOpen: true })
  const initialFocusRef = useRef(null)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={initialFocusRef}
      isCentered
      motionPreset="none"
    >
      <ModalOverlay />
      <ModalContent p={25}>
        <Flex flexDir="column" alignItems="center">
          <Icon boxSize={40} as={BiSad} />
          <Box my={12}>
            <Heading textAlign="center" mb={4}>
              {`Oops, we don't have your employee profile in the system`}
            </Heading>
            <Text textStyle="body-1" textAlign="center">
              Please check{' '}
              <Link target="_blank" href={SGID_CHECK_ELIGIBILITY_URL}>
                here
              </Link>{' '}
              if your government agency is supported. Meanwhile, login via your
              email instead.
            </Text>
          </Box>
          <Button isFullWidth onClick={onClose} ref={initialFocusRef}>
            Use Email Login
          </Button>
        </Flex>
      </ModalContent>
    </Modal>
  )
}
