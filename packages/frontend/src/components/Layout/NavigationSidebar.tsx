import { useContext } from 'react'
import { Link, matchPath, useLocation } from 'react-router-dom'
import { Box, Divider, Text } from '@chakra-ui/react'
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
  const { pathname } = useLocation()

  const { to, Icon: icon, text, otherLinks, isExternal } = link
  const selected = [to, ...(otherLinks || [])].some((link) =>
    matchPath(link, pathname),
  )

  return (
    <SidebarItem
      mx={{ sm: '1rem' }}
      w={{ lg: '16.75rem' }}
      icon={icon}
      as={Link}
      to={to}
      target={isExternal ? '_blank' : undefined}
      onClick={isExternal ? undefined : closeDrawer}
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
      <Box p={0}>
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
      </Box>

      <Text
        p={4}
        display={{ sm: 'none', lg: 'block' }}
        ml={{ sm: 0, lg: 2 }}
        textStyle="caption-3"
      >
        Resources
      </Text>
      <Divider my={2} hideFrom="lg" hideBelow="sm" />

      {/* bottom sidebar items */}
      <Box>
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
