import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  StackDivider,
  useDisclosure,
} from '@chakra-ui/react'

import NewsItem from './NewsItem'
import { NEWS_ITEM_LIST } from './NewsItemList'
import { TEST_ITEM_LIST } from './TestItemList'

interface NewsDrawerProps {
  handleClose: () => void
}

export default function NewsDrawer(props: NewsDrawerProps) {
  const { handleClose } = props

  const { isOpen, onOpen, onClose } = useDisclosure({ onClose: handleClose })

  return (
    <>
      <Button size="xs" variant="link" mr={4} onClick={onOpen}>
        What's new
      </Button>
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader textStyle="h2" color="secondary.700">
            What's New
          </DrawerHeader>

          <DrawerBody>
            <Stack
              divider={<StackDivider borderColor="gray.300"></StackDivider>}
              spacing="1rem"
            >
              {TEST_ITEM_LIST.map((item, index) => (
                <NewsItem key={index} {...item} />
              ))}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
