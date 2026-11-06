import {
  Box,
  Flex,
  Portal,
  ScaleFade,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'
import { useId } from 'react'
import { BiX } from 'react-icons/bi'

interface OptInDialogProps {
  isLoading?: boolean
  onOptIn: () => void | Promise<void>
}

/**
 * Non-modal so users can keep browsing templates while the prompt is open.
 */
export default function OptInModal({
  isLoading = false,
  onOptIn,
}: OptInDialogProps): JSX.Element {
  const titleId = useId()
  const descriptionId = useId()
  const { onClose, isOpen } = useDisclosure()

  return (
    <Portal>
      <Box
        position="fixed"
        bottom={6}
        right={6}
        left={{ base: 6, md: 'auto' }}
        zIndex="popover"
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <ScaleFade in={isOpen} initialScale={0.95} unmountOnExit>
          <Flex
            role="dialog"
            aria-modal={false}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !isLoading) {
                onClose()
              }
            }}
            flexDir="column"
            rowGap={6}
            maxW={{ md: '450px' }}
            p={6}
            bg="white"
            border="1px solid"
            borderColor="base.divider.medium"
            borderRadius="xl"
            boxShadow="sm"
          >
            <Flex flexDir="column" rowGap={2}>
              <Flex alignItems="flex-start" columnGap={4}>
                <Text
                  id={titleId}
                  as="h2"
                  flex={1}
                  textStyle="h5"
                  color="base.content.strong"
                >
                  Try community templates early
                </Text>
                <IconButton
                  icon={<BiX />}
                  aria-label="Close"
                  variant="clear"
                  colorScheme="secondary"
                  size="xs"
                  minH={7}
                  minW={7}
                  fontSize="xl"
                  isDisabled={isLoading}
                  onClick={onClose}
                />
              </Flex>
              <Text
                id={descriptionId}
                textStyle="body-1"
                color="base.content.default"
              >
                Join early access to view community templates shared by other
                Plumber users. Features may change.
              </Text>
            </Flex>
            <Flex columnGap={2}>
              <Button onClick={onOptIn} isLoading={isLoading}>
                View community templates
              </Button>
              <Button
                variant="clear"
                colorScheme="secondary"
                onClick={onClose}
                isDisabled={isLoading}
              >
                Not now
              </Button>
            </Flex>
          </Flex>
        </ScaleFade>
      </Box>
    </Portal>
  )
}
