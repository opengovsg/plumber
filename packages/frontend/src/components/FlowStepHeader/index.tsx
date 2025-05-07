import {
  type MouseEvent,
  type MouseEventHandler,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { BiArrowFromRight, BiHelpCircle, BiTrashAlt } from 'react-icons/bi'
import {
  Box,
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
import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import MenuAlertDialog from '../MenuAlertDialog'

import { flowStepHeaderStyles } from './styles'

interface FlowStepHeaderProps {
  iconUrl?: string
  caption: string
  hintAboveCaption: string | null
  isCompleted?: boolean
  isDrawerOpen: boolean
  isNested?: boolean
  onDelete?: MouseEventHandler
  isDeleting?: boolean
  onOpen: () => void
  onClose: () => void
  collapsed: boolean
  demoVideoUrl?: string
  demoVideoTitle?: string
  shouldHighlight?: boolean
}

const LOCAL_STORAGE_DEMO_TOOLTIP_KEY = 'demo-tooltip-clicked'

export default function FlowStepHeader(
  props: FlowStepHeaderProps,
): JSX.Element {
  const {
    iconUrl,
    caption,
    isNested,
    onDelete,
    isDeleting,
    shouldHighlight,
    onOpen,
    onClose,
    collapsed,
    demoVideoUrl,
    demoVideoTitle,
  } = props

  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  const handleClick = useCallback(() => {
    if (collapsed) {
      // We're currently collapsed, and user just expanded us.
      onOpen()
    } else {
      onClose()
    }
  }, [collapsed, onOpen, onClose])

  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

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
      {/* TODO: will be added back in test step accordion revamp */}
      {/* {!isCompleted && (
        <Flex
          {...flowStepHeaderStyles.incompleteContainer}
          borderColor={
            shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
          }
          boxSize={isNested ? 8 : 10}
          w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
        >
          <Icon boxSize={6} color="yellow.200" as={BiSolidErrorCircle} />
          <Text textStyle="body-2" color="base.content.medium" p={0} ml={1.5}>
            Update this step with the latest data
          </Text>
        </Flex>
      )} */}
      <Flex
        {...flowStepHeaderStyles.container}
        borderTopWidth={'1px'}
        borderColor={
          shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
        }
        borderTopRadius={'lg'}
        w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
      >
        {/* Top header */}
        <Flex
          {...flowStepHeaderStyles.topHeader}
          px={4}
          py={isNested ? 2 : 4}
          _hover={{
            bg: 'interaction.muted.neutral.hover',
            cursor: 'pointer',
            borderBottomRadius: collapsed ? 'inherit' : 'none',
          }}
          _active={{
            bg: 'interaction.muted.neutral.active',
            borderBottomRadius: collapsed ? 'inherit' : 'none',
          }}
          onClick={handleClick}
        >
          <Flex
            {...flowStepHeaderStyles.appIconWrapper}
            boxSize={isNested ? 6 : 8}
          >
            {/* App icon */}
            <Image
              src={iconUrl}
              boxSize={isNested ? 6 : 8}
              fit="contain"
              fallback={
                <Icon
                  boxSize={6}
                  as={BiArrowFromRight}
                  color="base.content.default"
                />
              }
            />
          </Flex>
          {/*  Captions */}
          <Flex direction="column" align="start" maxW="80%">
            <Flex alignItems="center" gap={2} maxW="100%">
              <Text
                textStyle="subhead-1"
                color="base.content.default"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                maxW="100%"
              >
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

          {/* Delete step button */}
          {onDelete && (
            <Flex ml="auto">
              <IconButton
                boxSize={isNested ? 8 : 10}
                onClick={(event) => {
                  onDialogOpen()
                  event.stopPropagation()
                }}
                variant="clear"
                aria-label="Delete Step"
                icon={<BiTrashAlt />}
                colorScheme="secondary"
                className={isMobile ? undefined : 'hover-remove-button'}
                visibility={isMobile ? 'visible' : 'hidden'}
                minHeight={isNested ? 6 : 8}
                minWidth={isNested ? 6 : 8}
              />
            </Flex>
          )}
        </Flex>
      </Flex>

      {isModalOpen && hasDemoVideo && (
        <Modal isCentered isOpen={true} onClose={onModalClose} size="5xl">
          <ModalOverlay bg="base.canvas.overlay" />
          <ModalContent p={4} borderRadius={8}>
            <DemoVideoModalContent src={demoVideoUrl} title={demoVideoTitle} />
          </ModalContent>
        </Modal>
      )}

      {onDelete && isDeleting !== undefined && (
        <MenuAlertDialog
          isDialogOpen={isDialogOpen}
          cancelRef={cancelRef}
          onDialogClose={onDialogClose}
          dialogHeader="Step"
          dialogType="delete"
          onClick={onDelete}
          isLoading={isDeleting}
        />
      )}
    </>
  )
}
