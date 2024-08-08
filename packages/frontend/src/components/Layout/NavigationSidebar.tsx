import { useContext } from 'react'
import { BiBookOpen, BiBulb } from 'react-icons/bi'
import { Link, useMatch } from 'react-router-dom'
import { Box, Text, useDisclosure } from '@chakra-ui/react'
import {
  Badge,
  SidebarContainer,
  SidebarItem,
} from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { LayoutNavigationContext } from '@/contexts/LayoutNavigation'

import DemoPageModal from './DemoPageModal'
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
        <Badge color="white" display={{ sm: 'none', lg: 'block' }}>
          {link.badge}
        </Badge>
      )}
    </SidebarItem>
  )
}

const templateDrawerLink: DrawerLink = {
  Icon: BiBookOpen,
  text: 'Templates',
  to: URLS.TEMPLATES,
}

const DemoSidebarItem = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <SidebarItem
        mx={{ sm: '1rem' }}
        w={{ lg: '16.75rem' }}
        icon={BiBulb}
        onClick={onOpen}
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
        <Text
          textStyle="subhead-1"
          ml={4}
          display={{ sm: 'none', lg: 'block' }}
        >
          Demo
        </Text>
      </SidebarItem>
      {isOpen && <DemoPageModal onClose={onClose} />}
    </>
  )
}

export default function NavigationSidebar() {
  const { links, closeDrawer } = useContext(LayoutNavigationContext)

  // TODO (mal): I will make a discriminated union and combine with the drawer links if more than 1 "sidebar modal item" exists
  return (
    <SidebarContainer variant="sticky">
      {links.map((link, index) => (
        <NavigationSidebarItem
          key={index}
          link={link}
          closeDrawer={closeDrawer}
        />
      ))}
      <Box position="fixed" bottom={2}>
        <NavigationSidebarItem
          link={templateDrawerLink}
          closeDrawer={closeDrawer}
        />
        <DemoSidebarItem />
      </Box>
    </SidebarContainer>
  )
}
