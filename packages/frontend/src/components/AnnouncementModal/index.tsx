import {
  Box,
  Flex,
  Modal,
  ModalContent,
  ModalFooter,
  ModalOverlay,
} from '@chakra-ui/react'
import {
  Button,
  ModalCloseButton,
  useIsMobile,
} from '@opengovsg/design-system-react'
import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'

import AnnouncementItem from './AnnouncementItem'
import { ANNOUNCEMENT_ITEM_LIST } from './AnnouncementItemList'
import { MotionBox } from './MotionBox'
import { ProgressIndicator } from './ProgressIndicator'

const ITEMS_LENGTH = ANNOUNCEMENT_ITEM_LIST.length

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  // Runs on the last slide's call to action, e.g. to send the user to the
  // feature being announced. Falls back to just closing the modal.
  onPrimaryAction?: () => void
  primaryActionLabel?: string
}

export default function AnnouncementModal(props: AnnouncementModalProps) {
  const {
    isOpen,
    onClose,
    onPrimaryAction,
    primaryActionLabel = 'Experience it now',
  } = props
  const [currActiveIdx, setCurrActiveIdx] = useState<number>(0)
  const currAnnouncement = ANNOUNCEMENT_ITEM_LIST[currActiveIdx]
  const isFirstAnnouncement = currActiveIdx === 0
  const isLastAnnouncement = currActiveIdx === ITEMS_LENGTH - 1
  const isMobile = useIsMobile()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      autoFocus={false}
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay />
      <ModalContent
        borderRadius="lg"
        display="flex"
        flexDirection="column"
        h="630px"
      >
        <ModalCloseButton size="xs" zIndex={1} mr={-4} mt={-2} />

        <Box flexGrow={1} overflow={isMobile ? 'scroll' : 'none'}>
          <AnimatePresence mode="wait">
            <MotionBox
              key={currActiveIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
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
                <Button onClick={onPrimaryAction ?? onClose}>
                  {primaryActionLabel}
                </Button>
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
