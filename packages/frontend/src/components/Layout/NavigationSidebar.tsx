import { useContext } from 'react'
import { Link, useMatch } from 'react-router-dom'
import { Box, Text } from '@chakra-ui/react'
import {
  Badge,
  SidebarContainer,
  SidebarItem,
} from '@opengovsg/design-system-react'

import { LayoutNavigationContext } from '@/contexts/LayoutNavigation'

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
      mx={{ sm: '1rem' }}
      w={{ lg: '16.75rem' }}
      icon={icon}
      as={Link}
      to={to}
      onClick={closeDrawer}
      isActive={!!selected}
      color="base.content.default"
      _hover={{
        color: 'primary.500',
        bg: 'interaction.muted.main.hover',
      }}
      _active={{
        color: 'primary.500',
        bg: 'interaction.muted.main.active',
      }}
      display="flex"
    >
      <Text textStyle="subhead-1" ml={4} display={{ sm: 'none', lg: 'block' }}>
        {text}
      </Text>
      {link.badge && (
        <Badge
          color="white"
          bg="primary.400"
          display={{ sm: 'none', lg: 'block' }}
        >
          {link.badge}
        </Badge>
      )}
    </SidebarItem>
  )
}

export default function NavigationSidebar() {
  const { links, closeDrawer } = useContext(LayoutNavigationContext)

  return (
    // top sidebar items
    <SidebarContainer variant="sticky">
      {links.map(
        (link, index) =>
          !link.isBottom && (
            <NavigationSidebarItem
              key={index}
              link={link}
              closeDrawer={closeDrawer}
            />
          ),
      )}

      {/* bottom sidebar items */}
      <Box
        position="fixed"
        bottom={2}
        w={{ base: 'calc(100% - 2rem)', sm: 'inherit' }}
      >
        {links.map(
          (link, index) =>
            link.isBottom && (
              <NavigationSidebarItem
                key={index}
                link={link}
                closeDrawer={closeDrawer}
              />
            ),
        )}
      </Box>
    </SidebarContainer>
  )
}
