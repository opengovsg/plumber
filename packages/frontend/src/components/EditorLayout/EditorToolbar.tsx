import { IFlow } from '@plumber/types'

import { BiCog, BiInfoCircle } from 'react-icons/bi'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { Hide, HStack, MenuButton, MenuList, Show } from '@chakra-ui/react'
import {
  Button,
  IconButton,
  Menu,
  TouchableTooltip,
} from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'

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
        leftIcon={<BiInfoCircle />}
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
  flowId,
  type,
  setLeaveToUrl,
  handleWarnOnLeave,
}: {
  flowId: string
  type: 'icon' | 'button'
  setLeaveToUrl: (url: string) => void
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
}) => {
  if (type === 'button') {
    return (
      <Button
        variant="clear"
        aria-label="settings"
        colorScheme="secondary"
        as={Link}
        to={URLS.FLOW_EDITOR_NOTIFICATIONS(flowId)}
        leftIcon={<BiCog />}
        onClick={(e) => {
          setLeaveToUrl(URLS.FLOW_EDITOR_NOTIFICATIONS(flowId))
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
        to={URLS.FLOW_EDITOR_NOTIFICATIONS(flowId)}
        variant="clear"
        aria-label="settings"
        icon={<BiCog />}
        colorScheme="secondary"
        _hover={{
          color: 'primary.500',
          bg: 'interaction.muted.main.hover',
        }}
        onClick={(e) => {
          setLeaveToUrl(URLS.FLOW_EDITOR_NOTIFICATIONS(flowId))
          handleWarnOnLeave(e)
        }}
      />
    </TouchableTooltip>
  )
}

interface EditorToolbarProps {
  flowId: string
  flow: IFlow
  isFlowIncomplete: boolean
  hasFlowTransfer: boolean
  loading: boolean
  shouldWarnOnLeave: boolean
  setShouldWarnOnPublish: (shouldWarnOnPublish: boolean) => void
  onFlowStatusUpdate: (active: boolean) => void
  setLeaveToUrl: (url: string) => void
  handleWarnOnLeave: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export default function EditorToolbar(props: EditorToolbarProps) {
  return (
    <>
      <Show above="md">
        <HStack>
          <GuideItem type="icon" />
          <SettingsItem {...props} type="icon" />
          <PublishButton {...props} />
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
            <GuideItem type="button" />
            <SettingsItem {...props} type="button" />
            <PublishButton {...props} />
          </MenuList>
        </Menu>
      </Hide>
    </>
  )
}
