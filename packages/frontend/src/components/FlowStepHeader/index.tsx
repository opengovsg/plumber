import {
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useState,
} from 'react'
import {
  BiArrowFromRight,
  BiHelpCircle,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
  BiTrashAlt,
} from 'react-icons/bi'
import {
  Box,
  chakra,
  Collapse as CollapseWithHiddenOverflow,
  Flex,
  Icon,
  Image,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import DemoVideoModalContent from '@/components/FlowRow/DemoVideoModalContent'

// Chakra's `Collapse` sets `overflow: hidden` by default, which causes dropdown
// menu items to be hidden. We override overflow by making `Collapse` a Chakra
// element.
const Collapse = chakra(CollapseWithHiddenOverflow)

interface FlowStepHeaderProps {
  iconUrl?: string
  caption: string
  hintAboveCaption: string
  isCompleted?: boolean
  onDelete?: MouseEventHandler
  onOpen: () => void
  onClose: () => void
  collapsed: boolean
  children: ReactNode
  demoVideoUrl?: string
  demoVideoTitle?: string
  isInfoboxPresent?: boolean
}

const LOCAL_STORAGE_DEMO_TOOLTIP_KEY = 'demo-tooltip-clicked'

export default function FlowStepHeader(
  props: FlowStepHeaderProps,
): JSX.Element {
  const {
    iconUrl,
    caption,
    hintAboveCaption,
    isCompleted,
    onDelete,
    onOpen,
    onClose,
    collapsed,
    children,
    demoVideoUrl,
    demoVideoTitle,
    isInfoboxPresent,
  } = props

  const handleClick = useCallback(() => {
    if (collapsed) {
      // We're currently collapsed, and user just expanded us.
      onOpen()
    } else {
      onClose()
    }
  }, [collapsed, onOpen, onClose])

  // for loading demo modal
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()
  const hasDemoVideo = !!demoVideoUrl && !!demoVideoTitle

  // check whether user has opened the demo tooltip previously
  const [hasSeenDemo, setHasSeenDemo] = useState<boolean>(
    localStorage.getItem(LOCAL_STORAGE_DEMO_TOOLTIP_KEY) === 'true',
  )

  const handleDemoClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      onModalOpen()
      localStorage.setItem(LOCAL_STORAGE_DEMO_TOOLTIP_KEY, 'true')
      setHasSeenDemo(true)
    },
    [onModalOpen],
  )

  return (
    <>
      <Box
        w="full"
        borderWidth="1px"
        borderColor="base.divider.medium"
        borderRadius="lg"
        borderTopRadius={isInfoboxPresent ? 'none' : 'lg'}
        p={0}
        bg="white"
        boxShadow={collapsed ? undefined : 'sm'}
        data-test="flow-step" // adding to identify element for e2e testing
      >
        {/*
         * Top header
         */}
        <Flex
          p={4}
          alignItems="center"
          borderRadius="inherit"
          _hover={{
            bg: 'interaction.muted.neutral.hover',
            cursor: 'pointer',
            borderBottomRadius: collapsed ? 'inherit' : 'none',
          }}
          _active={{
            bg: 'interaction.muted.neutral.active',
            borderBottomRadius: collapsed ? 'inherit' : 'none',
          }}
          w="full"
          onClick={handleClick}
        >
          <Flex
            position="relative"
            boxSize={16}
            mr={4}
            borderWidth={1}
            borderColor="base.divider.strong"
            justifyContent="center"
            alignItems="center"
          >
            {/*
             * App icon
             */}
            <Image
              src={iconUrl}
              boxSize={8}
              borderStyle="solid"
              fit="contain"
              fallback={
                <Icon
                  boxSize={6}
                  as={BiArrowFromRight}
                  color="base.content.default"
                />
              }
            />
            {/*
             * Step completion status badge
             */}
            {isCompleted !== undefined && (
              <Flex
                position="absolute"
                top={0}
                insetEnd={0}
                boxSize={6}
                transform="translate(0.5rem, -0.5rem)"
                borderRadius="full"
                bg="white"
              >
                {isCompleted ? (
                  <Icon
                    boxSize="full"
                    color="interaction.success.default"
                    as={BiSolidCheckCircle}
                  />
                ) : (
                  <Icon
                    boxSize="full"
                    color="yellow.200"
                    as={BiSolidErrorCircle}
                  />
                )}
              </Flex>
            )}
          </Flex>
          {/*
           * Captions
           */}
          <Flex direction="column" align="start">
            <Text textStyle="body-2" color="base.content.medium" p={0} mb={1.5}>
              {hintAboveCaption}
            </Text>

            <Flex alignItems="center" gap={2}>
              <Text textStyle="subhead-1" color="base.content.default">
                {caption}
              </Text>
              {hasDemoVideo && (
                <Tooltip
                  label="Learn how to set this up"
                  placement="top-start"
                  openDelay={300}
                  gutter={0}
                >
                  <Box boxSize="18px">
                    <Icon
                      as={BiHelpCircle}
                      boxSize="inherit"
                      sx={{
                        borderRadius: '50%',
                        animation: hasSeenDemo
                          ? undefined
                          : 'pulse 2s infinite',
                      }}
                      onClick={handleDemoClick}
                    />
                  </Box>
                </Tooltip>
              )}
            </Flex>
          </Flex>

          {/*
           * Delete step button
           */}
          {onDelete && (
            <Flex ml="auto">
              <IconButton
                onClick={onDelete}
                variant="clear"
                aria-label="Delete Step"
                icon={<BiTrashAlt />}
              />
            </Flex>
          )}
        </Flex>

        {/*
         * Step contents
         */}
        <Collapse
          in={!collapsed}
          unmountOnExit
          overflow={collapsed ? 'hidden' : 'initial !important'}
        >
          <Box borderTopWidth={1} p={0}>
            {children}
          </Box>
        </Collapse>
      </Box>

      {isModalOpen && hasDemoVideo && (
        <Modal isCentered isOpen={true} onClose={onModalClose} size="5xl">
          <ModalOverlay bg="base.canvas.overlay" />
          <ModalContent p={4} borderRadius={8}>
            <DemoVideoModalContent src={demoVideoUrl} title={demoVideoTitle} />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}
