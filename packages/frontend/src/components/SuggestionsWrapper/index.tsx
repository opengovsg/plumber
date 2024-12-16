import { Box, Divider, Flex, Text } from '@chakra-ui/react'

import { StepWithVariables } from '@/helpers/variables'

interface SuggestionsWrapperProps {
  suggestionType: 'attachments' | 'variables'
  leftPanelData: StepWithVariables[]
  rightPanel: React.ReactNode
  currentTab: number
  onTabChange: (index: number) => void
}

const HEADERS = {
  variables: {
    left: 'Use data from...',
    right: 'Choose data',
  },
  attachments: {
    left: 'Use attachments from...',
    right: 'Choose attachments',
  },
}

const PanelHeader = ({ children }: { children: string }) => {
  return (
    <Text
      pt={4}
      px={4}
      pb={2}
      textStyle="subhead-1"
      color="base.content.medium"
    >
      {children}
    </Text>
  )
}

export default function SuggestionsWrapper(props: SuggestionsWrapperProps) {
  const {
    suggestionType = 'variables',
    leftPanelData,
    rightPanel,
    currentTab,
    onTabChange,
  } = props

  const headers = HEADERS[suggestionType]

  return (
    <Flex w="100%" boxShadow="sm">
      {/* Left Panel --> Step Selector */}
      <Box flexGrow={1}>
        <PanelHeader>{headers.left}</PanelHeader>
        <Divider borderColor="base.divider.medium" />
        <Box h={64} overflowY="auto">
          {leftPanelData.map((option, index) => (
            <Text
              key={`primary-suggestion-${option.name}`}
              pl={4}
              py={3}
              bg={
                !!option.output?.length && currentTab === index
                  ? 'secondary.100'
                  : undefined
              }
              textStyle="subhead-1"
              color="base.content.strong"
              onClick={() => onTabChange(index)}
              _hover={{
                backgroundColor: 'secondary.50',
                cursor: 'pointer',
              }}
            >
              {option.name}
            </Text>
          ))}
        </Box>
      </Box>
      <Box>
        <Divider orientation="vertical" borderColor="base.divider.medium" />
      </Box>

      {/* Right Panel --> Data Selector */}
      <Box flexGrow={1} w="50%">
        <PanelHeader>{headers.left}</PanelHeader>
        <Divider borderColor="base.divider.medium" />
        {rightPanel}
      </Box>
    </Flex>
  )
}
