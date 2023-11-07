import { Box, Flex, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface EditorSnackbarProps {
  isOpen: boolean
  handleUnpublish: () => void
}

export default function EditorSnackbar(props: EditorSnackbarProps) {
  const { isOpen, handleUnpublish } = props
  const snackbarText = 'To edit this pipe, you need to unpublish it first'
  return (
    <Box
      position="fixed"
      right="50%"
      transform="translateX(50%)" // Center horizontally
      bottom={5}
      py={2}
      px={4}
      bg="base.canvas.inverse"
      color="white"
      borderRadius="0.25rem"
      boxShadow="0px 0px 10px 0px rgba(191, 191, 191, 0.50)"
      display={isOpen ? 'block' : 'none'}
    >
      <Flex justifyContent="center" alignItems="center" gap={2}>
        <Text textStyle={{ sm: 'body-2', md: 'body-1' }}>{snackbarText}</Text>
        <Button
          variant="clear"
          colorScheme="inverse"
          onClick={handleUnpublish}
          size={{ sm: 'sm', md: 'md' }}
        >
          Unpublish
        </Button>
      </Flex>
    </Box>
  )
}
