import { type MouseEventHandler, type ReactNode, useCallback } from 'react'
import {
  BiArrowFromRight,
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
  Text,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

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
}

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
  } = props

  const handleClick = useCallback(() => {
    if (collapsed) {
      // We're currently collapsed, and user just expanded us.
      onOpen()
    } else {
      onClose()
    }
  }, [collapsed, onOpen, onClose])

  return (
    <Box
      w="full"
      borderWidth="1px"
      borderColor="base.divider.medium"
      borderRadius="lg"
      p={0}
      bg="white"
      boxShadow={collapsed ? undefined : 'base'}
    >
      {/*
       * Top header
       */}
      <Flex
        p={4}
        alignItems="center"
        _hover={{ bg: 'interaction.muted.neutral.hover', cursor: 'pointer' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        w="full"
        onClick={handleClick}
      >
        <Flex
          position="relative"
          boxSize={16}
          mr={4}
          borderWidth={1}
          borderColor="base.divider.strong"
          borderRadius="base"
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
          {isCompleted && (
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
          <Text textStyle="subhead-1" color="base.content.default">
            {caption}
          </Text>
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
  )
}
