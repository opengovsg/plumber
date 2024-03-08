import { BiMenuAltLeft } from 'react-icons/bi'
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  HStack,
  Text,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import EditorSidebar from './EditorSidebar'
import { DrawerLink } from '.'

interface EditorDrawerProps {
  links: DrawerLink[]
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

export default function EditorDrawer(props: EditorDrawerProps) {
  const { links, isDrawerOpen, openDrawer, closeDrawer } = props

  return (
    <>
      <HStack alignItems="center" spacing={0}>
        <IconButton
          aria-label="Open Editor Drawer Icon Button"
          icon={<BiMenuAltLeft />}
          variant="clear"
          onClick={openDrawer}
          ml={3}
          color="base.content.strong"
          _hover={{ bg: 'interaction.muted.neutral.hover' }}
          _active={{ bg: 'interaction.muted.neutral.active' }}
        />
        <Text textStyle="subhead-1">Settings</Text>
      </HStack>
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
            <EditorSidebar links={links} closeDrawer={closeDrawer} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
