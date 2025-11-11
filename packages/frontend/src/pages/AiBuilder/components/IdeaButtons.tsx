import { Flex, Text } from '@chakra-ui/react'
import { Button, FormLabel, useIsMobile } from '@opengovsg/design-system-react'

import { TemplateIcon } from '@/helpers/flow-templates'
import { AiChatIdea, AiFormIdea } from '@/pages/Flows/constants'

interface IdeaButtonsProps {
  ideas: AiChatIdea[] | AiFormIdea[]
  onClick: (idea: AiChatIdea | AiFormIdea) => void
  builderType: 'chat' | 'form'
}

export default function IdeaButtons({
  ideas,
  onClick,
  builderType,
}: IdeaButtonsProps) {
  const isMobile = useIsMobile()
  const isForm = builderType === 'form'

  return (
    <Flex flexDir="row" alignItems="center">
      <FormLabel isRequired style={{ margin: 0, marginRight: '0.5rem' }}>
        {/* arbitrary isRequired to hide optional text */}
        Try:
      </FormLabel>
      <Flex
        flexDir="row"
        gap={2}
        justifyContent="space-between"
        flexWrap="wrap"
      >
        {ideas.map((idea) => (
          <Button
            key={idea.label}
            size="sm"
            bgColor="interaction.sub-subtle.default"
            color="gray.600"
            variant="clear"
            _hover={{
              bgColor: 'interaction.sub-subtle.hover',
            }}
            onClick={() => onClick(idea)}
            px={isForm ? 2 : 3}
            minH={4}
            w={isMobile ? 'calc(50% - 4px)' : 'auto'}
            flexShrink={0}
          >
            <TemplateIcon iconName={idea.icon} fontSize="1rem" />
            <Text textStyle="caption-1" ml={isForm ? 0 : '0.25rem'}>
              {idea.label}
            </Text>
          </Button>
        ))}
      </Flex>
    </Flex>
  )
}
