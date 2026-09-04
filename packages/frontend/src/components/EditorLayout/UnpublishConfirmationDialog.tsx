import type { IStep } from '@plumber/types'

import { RefObject } from 'react'
import { BiCheck, BiX } from 'react-icons/bi'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Flex,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { FORMSG_APP_KEY } from '@/helpers/formsg'

const DELAY_APP_KEY = 'delay'

interface UnpublishConfirmationDialogProps {
  cancelRef: RefObject<HTMLButtonElement>
  flowName: string
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onUnpublish: () => void | Promise<void>
  steps: IStep[]
}

function ConsequenceRow({
  icon,
  children,
}: {
  icon: typeof BiCheck
  children: string
}) {
  return (
    <Flex alignItems="flex-start" gap={2}>
      <Icon as={icon} boxSize={5} mt="2px" color="base.content.default" />
      <Text textStyle="body-1">{children}</Text>
    </Flex>
  )
}

export default function UnpublishConfirmationDialog(
  props: UnpublishConfirmationDialogProps,
) {
  const {
    cancelRef,
    flowName,
    isOpen,
    isLoading,
    onClose,
    onUnpublish,
    steps,
  } = props

  // Only delay steps count as long-lived: an MRF submission waits on an
  // external approver, so it isn't a run "in progress" the way a delay is.
  const isLongLivedRun = steps.some((step) => step.appKey === DELAY_APP_KEY)
  const hasFormSteps = steps.some((step) => step.appKey === FORMSG_APP_KEY)

  const handleUnpublish = async () => {
    await onUnpublish()
    onClose()
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      closeOnOverlayClick={!isLoading}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Unpublish {flowName}?</AlertDialogHeader>
          <AlertDialogBody>
            <VStack align="stretch" spacing={4}>
              <Text textStyle="body-1" color="base.content.medium">
                It stops running until you publish it again.
              </Text>
              <VStack align="stretch" spacing={2}>
                {hasFormSteps && (
                  <ConsequenceRow icon={BiCheck}>
                    Your form stays open and keeps collecting responses
                  </ConsequenceRow>
                )}
                <ConsequenceRow icon={BiX}>
                  No steps run: no emails sent, no rows created in your tiles
                </ConsequenceRow>
              </VStack>
              {isLongLivedRun ? (
                <Text textStyle="body-1">
                  Runs that already started will still finish.
                </Text>
              ) : null}
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              variant="clear"
              colorScheme="secondary"
              ref={cancelRef}
              onClick={onClose}
              isDisabled={isLoading}
            >
              Keep pipe published
            </Button>
            <Button
              colorScheme="critical"
              onClick={handleUnpublish}
              ml={3}
              isLoading={isLoading}
            >
              Unpublish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}
