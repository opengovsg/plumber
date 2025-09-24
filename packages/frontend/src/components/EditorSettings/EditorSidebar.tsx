import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import { SidebarContainer, SidebarItem } from '@opengovsg/design-system-react'

import { DrawerLink, GroupedDrawerLinks } from '.'

interface EditorSidebarItemProps {
  link: DrawerLink
  closeDrawer: () => void
}

interface EditorSidebarProps {
  groupedLinks: GroupedDrawerLinks[]
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
  const { groupedLinks, closeDrawer } = props

  return (
    <SidebarContainer>
      {groupedLinks.map(({ group, links }) => (
        <>
          <Text
            key={group}
            p={4}
            display={{ sm: 'none', lg: 'block' }}
            ml={{ sm: 0, lg: 2 }}
            textStyle="caption-3"
          >
            {group}
          </Text>
          {links.map((link, index) => (
            <EditorSidebarItem
              key={index}
              link={link}
              closeDrawer={closeDrawer}
            />
          ))}
        </>
      ))}
    </SidebarContainer>
  )
}
