import { Flex, Text } from '@chakra-ui/react'
import { Button, FormLabel } from '@opengovsg/design-system-react'

import { AiChatIdea, AiFormIdea } from '@/pages/Flows/constants'

interface IdeaButtonsProps {
  ideas: AiChatIdea[] | AiFormIdea[]
  onClick: (idea: AiChatIdea | AiFormIdea) => void
}

export default function IdeaButtons({ ideas, onClick }: IdeaButtonsProps) {
  return (
    <Flex flexDir="column">
      <FormLabel isRequired>
        {/* arbitrary isRequired to hide optional text */}
        Need inspiration? Try one of these:
      </FormLabel>
      <Flex flexDir="row" gap={2} justifyContent="space-between">
        {ideas.map((idea) => (
          <Button
            key={idea.label}
            size="xs"
            bgColor="interaction.muted.main.active"
            color="primary.500"
            variant="clear"
            _hover={{
              bgColor: 'primary.200',
            }}
            onClick={() => onClick(idea)}
          >
            <Text textStyle="caption-1">{idea.label}</Text>
          </Button>
        ))}
      </Flex>
    </Flex>
  )
}
