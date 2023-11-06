import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import { SidebarContainer, SidebarItem } from '@opengovsg/design-system-react'
import { type DrawerLink } from 'components/Layout'

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
    >
      <Text textStyle="subhead-1" ml={4} display={{ sm: 'none', lg: 'block' }}>
        {text}
      </Text>
    </SidebarItem>
  )
}

interface NavigationSidebarProps {
  links: DrawerLink[]
  closeDrawer: () => void
}

export default function NavigationSidebar(
  props: NavigationSidebarProps,
): JSX.Element {
  const { links, closeDrawer } = props

  return (
    <SidebarContainer>
      {links.map((link, index) => (
        <NavigationSidebarItem
          key={index}
          closeDrawer={closeDrawer}
          link={link}
        />
      ))}
    </SidebarContainer>
  )
}
