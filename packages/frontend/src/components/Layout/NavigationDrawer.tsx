import { BiMenu } from 'react-icons/bi'
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import { type DrawerLink } from 'components/Layout'

import NavigationSidebar from './NavigationSidebar'

interface NavigationDrawerProps {
  links: DrawerLink[]
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

export default function NavigationDrawer(props: NavigationDrawerProps) {
  const { links, isDrawerOpen, openDrawer, closeDrawer } = props

  return (
    <>
      <IconButton
        aria-label="Open Navigation Drawer Icon Button"
        icon={<BiMenu />}
        variant="clear"
        onClick={openDrawer}
        mr={2}
        color="base.content.strong"
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
      />
      <Drawer placement="left" onClose={closeDrawer} isOpen={isDrawerOpen}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton
            pos="relative"
            mt={8}
            ml={4}
            color="base.content.strong"
          />
          <DrawerBody p={4}>
            <NavigationSidebar links={links} closeDrawer={closeDrawer} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
