import { useContext } from 'react'
import { BiCog, BiHistory, BiInfoCircle } from 'react-icons/bi'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { Box, Hide, HStack, MenuButton, MenuList, Show } from '@chakra-ui/react'
import {
  Button,
  IconButton,
  Menu,
  Tag,
  TagLabel,
  TagLeftIcon,
  TouchableTooltip,
} from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { tagStyles } from '@/pages/Tiles/components/style'

import PublishButton from './PublishButton'

const GuideItem = ({ type }: { type: 'icon' | 'button' }) => {
  if (type === 'button') {
    return (
      <Button
        variant="clear"
        aria-label="guide"
        colorScheme="secondary"
        target="_blank"
        as={Link}
        to={URLS.GUIDE_LINK}
        w="100%"
      >
        Guide
      </Button>
    )
  }
  return (
    <TouchableTooltip label="Guide" aria-label="guide tooltip">
      <IconButton
        as={Link}
        to={URLS.GUIDE_LINK}
        target="_blank"
        variant="clear"
        aria-label="guide"
        icon={<BiInfoCircle />}
        colorScheme="secondary"
        _hover={{
          color: 'primary.500',
          bg: 'interaction.muted.main.hover',
        }}
      />
    </TouchableTooltip>
  )
}

const SettingsItem = ({
  type,
  setLeaveToUrl,
  handleWarnOnLeave,
  settingsLink,
}: {
  type: 'icon' | 'button'
  setLeaveToUrl: (url: string) => void
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
  settingsLink: string
}) => {
  if (type === 'button') {
    return (
      <Button
        variant="clear"
        aria-label="settings"
        colorScheme="secondary"
        as={Link}
        to={settingsLink}
        w="100%"
        onClick={(e) => {
          setLeaveToUrl(settingsLink)
          handleWarnOnLeave(e)
        }}
      >
        Settings
      </Button>
    )
  }
  return (
    <TouchableTooltip label="Settings" aria-label="settings tooltip">
      <IconButton
        as={Link}
        to={settingsLink}
        variant="clear"
        aria-label="settings"
        icon={<BiCog />}
        colorScheme="secondary"
        _hover={{
          color: 'primary.500',
          bg: 'interaction.muted.main.hover',
        }}
        onClick={(e) => {
          setLeaveToUrl(settingsLink)
          handleWarnOnLeave(e)
        }}
      />
    </TouchableTooltip>
  )
}

const ExecutionsItem = ({ type }: { type: 'icon' | 'button' }) => {
  const { flowId } = useContext(EditorContext)
  if (type === 'button') {
    return (
      <Button
        variant="clear"
        aria-label="executions"
        colorScheme="secondary"
        as={Link}
        to={URLS.EXECUTIONS_FOR_FLOW(flowId)}
        w="100%"
      >
        Executions
      </Button>
    )
  }
  return (
    <TouchableTooltip label="Executions" aria-label="executions-tooltip">
      <IconButton
        as={Link}
        to={URLS.EXECUTIONS_FOR_FLOW(flowId)}
        variant="clear"
        aria-label="executions"
        _hover={{
          color: 'primary.500',
          bg: 'interaction.muted.main.hover',
        }}
        icon={<BiHistory />}
        colorScheme="secondary"
      />
    </TouchableTooltip>
  )
}

const ViewOnlyTag = () => {
  return (
    <Tag {...tagStyles}>
      <TagLeftIcon as={MdOutlineRemoveRedEye} />
      <TagLabel>View only</TagLabel>
    </Tag>
  )
}

const LiveTag = () => {
  return (
    <TouchableTooltip
      label="Your pipe is running. It will do the steps you set up."
      aria-label="live tooltip"
    >
      <Tag
        {...tagStyles}
        colorScheme="success"
        bgColor="transparent"
        mr={4}
        pointerEvents="auto"
      >
        <Box position="relative" boxSize={2} flexShrink={0}>
          <Box
            position="absolute"
            inset={0}
            borderRadius="full"
            bg="currentColor"
            sx={{
              animation:
                'live-dot-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              '@keyframes live-dot-ping': {
                '75%, 100%': {
                  transform: 'scale(2.2)',
                  opacity: 0,
                },
              },
            }}
          />
          <Box boxSize={2} borderRadius="full" bg="currentColor" />
        </Box>
        <TagLabel>Live</TagLabel>
      </Tag>
    </TouchableTooltip>
  )
}

interface EditorToolbarProps {
  loading: boolean
  shouldWarnOnLeave: boolean
  setShouldWarnOnPublish: (shouldWarnOnPublish: boolean) => void
  onFlowStatusUpdate: (active: boolean) => void
  onUnpublish: () => void
  setLeaveToUrl: (url: string) => void
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export default function EditorToolbar(props: EditorToolbarProps) {
  const { flow, flowId } = useContext(EditorContext)
  // TODO: remove this once we open collaborators to all users
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const settingsLink = getFlagValue('collaborators', false)
    ? URLS.FLOW_EDITOR_SHARE(flowId)
    : URLS.FLOW_EDITOR_TRANSFERS(flowId)

  return (
    <>
      <Show above="md">
        <HStack>
          <ExecutionsItem type="icon" />
          <GuideItem type="icon" />
          <SettingsItem {...props} type="icon" settingsLink={settingsLink} />
          {flow?.active && <LiveTag />}
          {flow?.role === 'viewer' ? (
            <ViewOnlyTag />
          ) : (
            <PublishButton {...props} />
          )}
        </HStack>
      </Show>
      <Hide above="md">
        <Menu>
          <MenuButton
            as={IconButton}
            colorScheme="secondary"
            variant="clear"
            icon={<HiOutlineDotsVertical />}
          />
          <MenuList
            display="flex"
            flexDir="column"
            borderRadius="md"
            alignItems="start"
            gap={2}
            px={2}
          >
            <ExecutionsItem type="button" />
            <GuideItem type="button" />
            <SettingsItem
              {...props}
              type="button"
              settingsLink={settingsLink}
            />
            {flow?.active && <LiveTag />}
            {flow?.role === 'viewer' ? (
              <ViewOnlyTag />
            ) : (
              <PublishButton {...props} />
            )}
          </MenuList>
        </Menu>
      </Hide>
    </>
  )
}
