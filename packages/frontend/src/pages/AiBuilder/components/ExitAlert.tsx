import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

interface ExitAlertProps {
  cancelRef: React.RefObject<HTMLButtonElement>
  isOpen: boolean
  onClose: () => void
  onExit: () => void
}

const defaultStyles = {
  ml: 6 /* Add spacing from the left edge */,
  my: 6 /* Remove default vertical margins */,
  maxW: '300px' /* Set a maximum width */,
  w: '100%' /* Ensure it takes full width */,
}

const mobileStyles = {
  maxW: '300px' /* Set a maximum width */,
  w: '100%' /* Ensure it takes full width */,
}

export default function ExitAlert({
  cancelRef,
  isOpen,
  onClose,
  onExit,
}: ExitAlertProps) {
  const isMobile = useIsMobile()
  const contentStyles = isMobile ? mobileStyles : defaultStyles

  const handleExit = () => {
    onExit?.()
    onClose()
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay
        display="flex"
        alignItems="flex-start"
        justifyContent="flex-start"
      >
        <AlertDialogContent borderRadius={8} {...contentStyles}>
          <AlertDialogHeader p={6}>
            <Text textStyle="h5">Your progress will be lost if you exit</Text>
          </AlertDialogHeader>

          <AlertDialogFooter
            display="flex"
            flexDirection="column"
            gap={2}
            pt={0}
            pb={6}
            px={6}
          >
            <Button colorScheme="critical" onClick={handleExit} width="full">
              Exit anyway
            </Button>
            <Button
              variant="clear"
              colorScheme="secondary"
              onClick={onClose}
              width="full"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}
