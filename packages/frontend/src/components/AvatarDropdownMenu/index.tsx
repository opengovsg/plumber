import { useNavigate } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import {
  AvatarMenu,
  AvatarMenuDivider,
  Menu,
} from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import apolloClient from '@/graphql/client'
import useAuthentication from '@/hooks/useAuthentication'

export default function AvatarDropdownMenu() {
  const { logout, currentUser } = useAuthentication()
  const navigate = useNavigate()

  const onLogoutClick = async () => {
    await logout()
    await apolloClient.clearStore()
    navigate(URLS.ROOT)
  }

  return (
    <AvatarMenu size="xs" name={currentUser?.email}>
      <Menu.Item pointerEvents="none">
        <Text color="base.content.medium" textStyle="subhead-3">
          {currentUser?.email}
        </Text>
      </Menu.Item>

      <AvatarMenuDivider />

      <Menu.Item onClick={() => navigate(URLS.TRANSFERS)}>
        <Text>Pipe transfer requests</Text>
      </Menu.Item>

      <Menu.Item onClick={() => window.open(URLS.FEEDBACK_FORM_LINK, '_blank')}>
        <Text>Give feedback</Text>
      </Menu.Item>

      <AvatarMenuDivider />

      <Menu.Item onClick={onLogoutClick}>
        <Text>Logout</Text>
      </Menu.Item>
    </AvatarMenu>
  )
}
