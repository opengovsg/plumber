import { BiChat, BiLogOut, BiUser } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { Icon, Text } from '@chakra-ui/react'
import {
  AvatarMenu,
  AvatarMenuDivider,
  Menu,
} from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import apolloClient from 'graphql/client'
import useAuthentication from 'hooks/useAuthentication'

export default function AvatarDropdownMenu() {
  const { logout, currentUser } = useAuthentication()
  const navigate = useNavigate()

  const onLogoutClick = async () => {
    await logout()
    await apolloClient.clearStore()
    navigate(URLS.ROOT)
  }

  return (
    <AvatarMenu bg="primary.600" size="xs" name={currentUser?.email}>
      <Menu.Item
        style={{ pointerEvents: 'none' }}
        icon={<Icon as={BiUser} boxSize={5} />}
      >
        <Text textStyle="subhead-1">{currentUser?.email}</Text>
      </Menu.Item>

      <AvatarMenuDivider />

      <Menu.Item
        icon={<Icon as={BiChat} boxSize={5} />}
        onClick={() => window.open(URLS.FEEDBACK_FORM_LINK, '_blank')}
      >
        <Text textStyle="body-1">Give feedback</Text>
      </Menu.Item>
      <Menu.Item
        icon={<Icon ml={-0.5} as={BiLogOut} boxSize={5} color="primary.600" />}
        onClick={onLogoutClick}
      >
        <Text textStyle="body-1">Logout</Text>
      </Menu.Item>
    </AvatarMenu>
  )
}
