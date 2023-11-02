import { BiMenu } from 'react-icons/bi'
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import NavigationSidebar from './NavigationSidebar'
import { DrawerLink } from '.'

interface NavigationDrawerProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  links: DrawerLink[]
}

export default function NavigationDrawer(props: NavigationDrawerProps) {
  const { isOpen, onOpen, onClose, links } = props

  return (
    <>
      <IconButton
        aria-label="Open Navigation Drawer Icon Button"
        icon={<BiMenu />}
        variant="clear"
        onClick={onOpen}
      />
      <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton
            pos="relative"
            mt={8}
            ml={4}
            color="base.content.strong"
          />
          <DrawerBody p={4}>
            <NavigationSidebar links={links} onClose={onClose} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
