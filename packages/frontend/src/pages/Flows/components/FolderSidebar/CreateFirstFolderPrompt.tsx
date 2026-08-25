import { BiPlus } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

export interface CreateFirstFolderPromptProps {
  onCreate: () => void
}

// Shown instead of the folder rail for a user with no folders at all, so
// the page stays byte-for-byte unchanged (no rail, no layout shift) while
// folder creation is still discoverable. Copy matches the approved
// concept's zero-folder prompt card.
export default function CreateFirstFolderPrompt(
  props: CreateFirstFolderPromptProps,
) {
  const { onCreate } = props

  return (
    <Flex
      align={{ base: 'stretch', sm: 'center' }}
      justify="space-between"
      gap={3}
      flexDir={{ base: 'column', sm: 'row' }}
      bg="primary.50"
      border="1px solid"
      borderColor="primary.100"
      borderRadius={4}
      px={4}
      py={3}
      mb={4}
    >
      <Flex flexDir="column" gap={0.5}>
        <Text textStyle="subhead-1">Group your pipes</Text>
        <Text textStyle="body-2" color="base.content.medium">
          Create a folder to keep related pipes together. Only you see your
          folders.
        </Text>
      </Flex>
      <Button
        size="sm"
        leftIcon={<Icon as={BiPlus} boxSize={4} />}
        onClick={onCreate}
        flexShrink={0}
      >
        New folder
      </Button>
    </Flex>
  )
}
