import { useContext } from 'react'
import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import {
  Badge,
  SidebarContainer,
  SidebarItem,
} from '@opengovsg/design-system-react'
import { LayoutNavigationContext } from 'contexts/LayoutNavigation'

import { DrawerLink } from '.'

interface NavigationSidebarItemProps {
  link: DrawerLink
  closeDrawer: () => void
}

function NavigationSidebarItem({
  link,
  closeDrawer,
}: NavigationSidebarItemProps): JSX.Element {
  const { to, Icon: icon, text } = link
  const selected = useMatch({ path: to, end: true })

  return (
    <SidebarItem
      mx={{ sm: '8px' }}
      w={{ lg: '268px' }}
      icon={icon}
      as={Link}
      to={to}
      onClick={closeDrawer}
      isActive={!!selected}
      color="base.content.default"
      _hover={{
        color: 'primary.600',
        bg: 'interaction.muted.main.hover',
      }}
      _active={{
        color: 'primary.600',
        bg: 'interaction.muted.main.active',
      }}
      display="flex"
    >
      <Text textStyle="subhead-1" ml={4} display={{ sm: 'none', lg: 'block' }}>
        {text}
      </Text>
      {link.badge && (
        <Badge color="white" display={{ sm: 'none', lg: 'block' }}>
          {link.badge}
        </Badge>
      )}
    </SidebarItem>
  )
}

export default function NavigationSidebar() {
  const { links, closeDrawer } = useContext(LayoutNavigationContext)

  return (
    <SidebarContainer>
      {links.map((link, index) => (
        <NavigationSidebarItem
          key={index}
          link={link}
          closeDrawer={closeDrawer}
        />
      ))}
    </SidebarContainer>
  )
}
