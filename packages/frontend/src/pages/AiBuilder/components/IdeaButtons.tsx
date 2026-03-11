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
        flexDir={{ base: 'column', md: 'row' }}
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
            flex={{ base: 'none', md: '1' }}
            w={{ base: 'full', md: 'auto' }}
            minW={{ base: 'auto', md: '150px' }}
            maxW={{ base: 'none', md: '250px' }}
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
