import {
  Box,
  Flex,
  Icon,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { useEffect } from 'react'
import type { IconType } from 'react-icons'
import { BiCheck, BiInfoCircle } from 'react-icons/bi'

import { getItem, setItem } from '@/helpers/storage'

const SEEN_STORAGE_KEY = 'community-templates-early-access-modal-seen'

interface EarlyAccessModalProps {
  isLoading?: boolean
  onTurnOn: () => void | Promise<void>
}

interface PreviewCardData {
  title: string
  apps: string[]
  author: string
  initials: string
  avatarBg: string
  avatarColor: string
  usage?: string
  rotate?: string
}

const PREVIEW_CARDS: PreviewCardData[] = [
  {
    title: 'Grant application intake',
    apps: ['FormSG', 'Tiles'],
    author: 'Jane Tan · MOH',
    initials: 'JT',
    avatarBg: '#DCE7F5',
    avatarColor: '#2F5C99',
    rotate: '-4deg',
  },
  {
    title: 'Weekly duty roster reminder',
    apps: ['Scheduler', 'Telegram'],
    author: 'Ahmad R. · HDB',
    initials: 'AR',
    avatarBg: '#E2EEED',
    avatarColor: '#0F796F',
    usage: 'Used 64 times',
  },
  {
    title: 'Event RSVP tracker',
    apps: ['FormSG', 'Excel'],
    author: 'Priya N. · MOE',
    initials: 'PN',
    avatarBg: '#FFF3D6',
    avatarColor: '#8A6100',
    rotate: '4deg',
  },
]

const POINTS: { icon: IconType; color: string; text: string }[] = [
  {
    icon: BiInfoCircle,
    color: '#7A5600',
    text: 'Community templates are not reviewed by the Plumber team',
  },
  {
    icon: BiCheck,
    color: 'interaction.success.default',
    text: 'Your pipes stay private unless you choose to share one',
  },
  {
    icon: BiCheck,
    color: 'interaction.success.default',
    text: 'You can turn this off anytime from the Templates page',
  },
]

function PreviewCard({ card }: { card: PreviewCardData }): JSX.Element {
  const isFeatured = !card.rotate
  return (
    <Flex
      flexDir="column"
      rowGap={2.5}
      w="148px"
      h={isFeatured ? '136px' : '120px'}
      p={3.5}
      flexShrink={0}
      bg="white"
      border="1px solid"
      borderColor="base.divider.medium"
      borderTopRadius="md"
      boxShadow={isFeatured ? '0px 4px 16px #CF1A681F' : undefined}
      transform={card.rotate ? `rotate(${card.rotate})` : undefined}
    >
      <Flex columnGap={1}>
        {card.apps.map((app) => (
          <Box
            key={app}
            px={1.5}
            py={0.5}
            borderRadius="sm"
            bg="interaction.sub-subtle.default"
          >
            <Text
              fontSize="9px"
              lineHeight="12px"
              fontWeight={500}
              color="interaction.sub.default"
            >
              {app}
            </Text>
          </Box>
        ))}
      </Flex>
      <Text
        fontSize="12px"
        lineHeight="15px"
        fontWeight={600}
        color="base.content.strong"
      >
        {card.title}
      </Text>
      <Flex alignItems="center" columnGap={1.5}>
        <Flex
          alignItems="center"
          justifyContent="center"
          boxSize={4}
          flexShrink={0}
          borderRadius="md"
          bg={card.avatarBg}
        >
          <Text
            fontSize="7px"
            lineHeight="10px"
            fontWeight={600}
            color={card.avatarColor}
          >
            {card.initials}
          </Text>
        </Flex>
        <Text fontSize="10px" lineHeight="12px" color="base.content.medium">
          {card.author}
        </Text>
      </Flex>
      {card.usage && (
        <Text fontSize="10px" lineHeight="12px" color="base.content.medium">
          {card.usage}
        </Text>
      )}
    </Flex>
  )
}

export default function EarlyAccessModal({
  isLoading = false,
  onTurnOn,
}: EarlyAccessModalProps): JSX.Element {
  const { isOpen, onClose } = useDisclosure({
    defaultIsOpen: getItem(SEEN_STORAGE_KEY) !== 'true',
  })

  // Marking it seen on open keeps a refresh or "Not now" from showing it again.
  useEffect(() => {
    if (isOpen) {
      setItem(SEEN_STORAGE_KEY, 'true')
    }
  }, [isOpen])

  const handleTurnOn = async () => {
    await onTurnOn()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      closeOnOverlayClick={!isLoading}
      closeOnEsc={!isLoading}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent
        maxW="560px"
        mx={4}
        overflow="hidden"
        borderRadius="md"
        boxShadow="0px 12px 40px #0000002E"
      >
        <Flex
          aria-hidden
          alignItems="flex-end"
          justifyContent="center"
          columnGap={3}
          h="168px"
          pt={7}
          px={8}
          overflow="hidden"
          bg="primary.50"
          borderBottom="1px solid"
          borderColor="primary.100"
        >
          {PREVIEW_CARDS.map((card) => (
            <PreviewCard key={card.title} card={card} />
          ))}
        </Flex>

        <ModalHeader px={8} pt={7} pb={0}>
          <Stack spacing={2.5} alignItems="flex-start">
            <Box
              px={2}
              py={0.5}
              borderRadius="10px"
              bg="#FFF3D6"
              border="1px solid"
              borderColor="#F2D58A"
            >
              <Text
                fontSize="11px"
                lineHeight="14px"
                letterSpacing="0.04em"
                fontWeight={600}
                color="#7A5600"
              >
                BETA
              </Text>
            </Box>
            <Text
              as="h2"
              fontSize="24px"
              lineHeight="30px"
              letterSpacing="-0.01em"
              fontWeight={600}
              color="base.content.strong"
            >
              Try community templates?
            </Text>
            <Text
              fontSize="15px"
              lineHeight="23px"
              fontWeight={400}
              color="base.content.default"
            >
              Browse pipes that other public officers have shared, and share
              your own. We’re trialling this to learn if it’s useful.
            </Text>
          </Stack>
        </ModalHeader>

        <ModalBody px={8} pt={5} pb={0}>
          <Stack as="ul" listStyleType="none" spacing={2.5}>
            {POINTS.map(({ icon, color, text }) => (
              <Flex as="li" key={text} alignItems="flex-start" columnGap={2.5}>
                <Icon
                  as={icon}
                  boxSize="18px"
                  mt="1px"
                  flexShrink={0}
                  color={color}
                />
                <Text textStyle="body-2" color="base.content.default">
                  {text}
                </Text>
              </Flex>
            ))}
          </Stack>
        </ModalBody>

        <ModalFooter columnGap={3} px={8} pt={7} pb={8}>
          <Button variant="outline" onClick={onClose} isDisabled={isLoading}>
            Not now
          </Button>
          <Button onClick={handleTurnOn} isLoading={isLoading}>
            Turn on
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
