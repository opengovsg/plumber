import { useState } from 'react'
import {
  Box,
  Flex,
  Modal,
  ModalContent,
  ModalFooter,
  ModalOverlay,
} from '@chakra-ui/react'
import { Button, ModalCloseButton } from '@opengovsg/design-system-react'
import { AnimatePresence } from 'framer-motion'

import AnnouncementItem from './AnnouncementItem'
import { ANNOUNCEMENT_ITEM_LIST } from './AnnouncementItemList'
import { MotionBox } from './MotionBox'
import { ProgressIndicator } from './ProgressIndicator'

const ITEMS_LENGTH = ANNOUNCEMENT_ITEM_LIST.length
export const LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY =
  'announcement-modal-last-opened'

export const LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP = '2025-05-26'

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AnnouncementModal(props: AnnouncementModalProps) {
  const { isOpen, onClose } = props
  const [currActiveIdx, setCurrActiveIdx] = useState<number>(0)
  const currAnnouncement = ANNOUNCEMENT_ITEM_LIST[currActiveIdx]
  const isFirstAnnouncement = currActiveIdx === 0
  const isLastAnnouncement = currActiveIdx === ITEMS_LENGTH - 1

  return (
    <Modal isOpen={isOpen} onClose={onClose} autoFocus={false}>
      <ModalOverlay />
      <ModalContent
        borderRadius="lg"
        display="flex"
        flexDirection="column"
        h="80vh"
      >
        <ModalCloseButton boxSize={5} zIndex={1} mr={-4} mt={-2} />

        <Box flexGrow={1} overflow="hidden">
          <AnimatePresence mode="wait">
            <MotionBox
              key={currActiveIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AnnouncementItem {...currAnnouncement} />
            </MotionBox>
          </AnimatePresence>
        </Box>

        <ModalFooter>
          <Flex
            width="100vw"
            alignItems="center"
            justifyContent="space-between"
          >
            <ProgressIndicator
              numIndicators={ITEMS_LENGTH}
              currActiveIdx={currActiveIdx}
              onClick={setCurrActiveIdx}
            />
            <Flex gap={4}>
              {!isFirstAnnouncement && (
                <Button
                  onClick={() => setCurrActiveIdx(currActiveIdx - 1)}
                  variant="clear"
                  colorScheme="secondary"
                >
                  Back
                </Button>
              )}

              {isLastAnnouncement ? (
                <Button onClick={onClose}>Experience it now</Button>
              ) : (
                <Button onClick={() => setCurrActiveIdx(currActiveIdx + 1)}>
                  Next
                </Button>
              )}
            </Flex>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
