import { useContext } from 'react'
import { BiMenu } from 'react-icons/bi'
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import { LayoutNavigationContext } from '@/contexts/LayoutNavigation'

import NavigationSidebar from './NavigationSidebar'

export default function NavigationDrawer() {
  const { isDrawerOpen, openDrawer, closeDrawer } = useContext(
    LayoutNavigationContext,
  )

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
            <NavigationSidebar />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
