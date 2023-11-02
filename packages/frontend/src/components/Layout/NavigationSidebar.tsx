import { useContext } from 'react'
import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import { SidebarContainer, SidebarItem } from '@opengovsg/design-system-react'
import { LayoutNavigationContext } from 'contexts/LayoutNavigation'

export default function NavigationSidebar() {
  const { links, closeDrawer } = useContext(LayoutNavigationContext)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const selected = (to: string) => useMatch({ path: to, end: true })

  return (
    <SidebarContainer>
      {links.map(({ Icon, text, to }, index) => (
        <SidebarItem
          key={`${to}-${index}`}
          mx={{ sm: '8px' }}
          w={{ lg: '268px' }}
          icon={Icon}
          as={Link}
          to={to}
          onClick={closeDrawer}
          isActive={!!selected(to)}
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
          <Text
            textStyle="subhead-1"
            ml={4}
            display={{ sm: 'none', lg: 'block' }}
          >
            {text}
          </Text>
        </SidebarItem>
      ))}
    </SidebarContainer>
  )
}
