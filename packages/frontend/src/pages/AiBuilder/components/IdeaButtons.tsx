import { Flex, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { type AiChatIdea } from '@/pages/AiBuilder/constants'

interface IdeaButtonsProps {
  ideas: AiChatIdea[]
  onClick: (idea: AiChatIdea) => void
}

export default function IdeaButtons({ ideas, onClick }: IdeaButtonsProps) {
  return (
    <Flex flexDir="row" alignItems="center" w="full">
      <Flex
        flexDir="row"
        gap={3}
        justifyContent="space-evenly"
        flexWrap="wrap"
        w="full"
      >
        {ideas.map((idea) => (
          <Button
            key={idea.label}
            size="sm"
            bgColor="primary.50"
            color="secondary.700"
            variant="clear"
            _hover={{
              bgColor: 'interaction.main-subtle.default',
            }}
            onClick={() => onClick(idea)}
            px={3}
            minH={4}
            flex="1"
            minW="150px"
            maxW="250px"
            whiteSpace="normal"
            height="auto"
          >
            <Text
              textStyle="caption-1"
              ml="0.25rem"
              whiteSpace="normal"
              textAlign="left"
            >
              {idea.label}
            </Text>
          </Button>
        ))}
      </Flex>
    </Flex>
  )
}
