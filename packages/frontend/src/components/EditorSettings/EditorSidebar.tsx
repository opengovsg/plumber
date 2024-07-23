import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import { SidebarContainer, SidebarItem } from '@opengovsg/design-system-react'

import { DrawerLink } from '.'

interface EditorSidebarItemProps {
  link: DrawerLink
  closeDrawer: () => void
}

interface EditorSidebarProps {
  links: DrawerLink[]
  closeDrawer: () => void
}

function EditorSidebarItem({
  link,
  closeDrawer,
}: EditorSidebarItemProps): JSX.Element {
  const { to, Icon: icon, text } = link
  const selected = useMatch({ path: to, end: true })

  return (
    <SidebarItem
      mx={{ md: '1rem' }}
      w={{ md: '14.75rem' }}
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
    >
      <Text textStyle="subhead-1" ml={4}>
        {text}
      </Text>
    </SidebarItem>
  )
}

export default function EditorSidebar(props: EditorSidebarProps) {
  const { links, closeDrawer } = props
  return (
    <SidebarContainer>
      {links.map((link, index) => (
        <EditorSidebarItem
          key={index}
          link={link}
          closeDrawer={closeDrawer}
        ></EditorSidebarItem>
      ))}
    </SidebarContainer>
  )
}
