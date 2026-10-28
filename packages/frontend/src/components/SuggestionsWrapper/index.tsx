import { Box, Flex, Text } from '@chakra-ui/react'

import { SUGGESTION_VARIABLE_ITEM_HEIGHT } from '@/components/VariablesList'
import { StepWithVariables } from '@/helpers/variables'

interface SuggestionsWrapperProps {
  suggestionType: 'attachments' | 'variables'
  leftPanelData: StepWithVariables[]
  rightPanel: React.ReactNode
  currentTab: number
  onTabChange: (index: number) => void
}

const TITLES = {
  variables: 'Use data from (optional)',
  attachments: 'Use attachments from (optional)',
}

// Fixed so the panel does not grow with the number of steps or fields.
export const PANEL_BODY_HEIGHT = '232px'

// IMPORTANT: The virtualized list must scroll itself, so it needs a definite
// height. This is the panel body less the 37px column header and its border.
export const PANEL_LIST_MAX_HEIGHT = '195px'

const PanelTitle = ({ children }: { children: string }) => {
  return (
    <Text
      pt={3}
      px={5}
      pb={2}
      borderBottomWidth="1px"
      borderBottomColor="base.divider.medium"
      textStyle="caption-1"
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

  const title = TITLES[suggestionType]

  return (
    <Flex
      direction="column"
      w="100%"
      h={PANEL_BODY_HEIGHT}
      boxShadow="sm"
      borderRadius="lg"
      overflow="hidden"
    >
      <PanelTitle>{title}</PanelTitle>
      <Flex flex={1} minH={0}>
        {/* Left Panel --> Step Selector */}
        <Box
          w="34%"
          minW="144px"
          overflowY="auto"
          borderRightWidth="1px"
          borderRightColor="base.divider.medium"
        >
          {leftPanelData.map((option, index) => {
            const isSelected = !!option.output?.length && currentTab === index
            return (
              <Flex
                key={`primary-suggestion-${option.name}`}
                h={`${SUGGESTION_VARIABLE_ITEM_HEIGHT}px`}
                flexShrink={0}
                alignItems="center"
                px={5}
                // Same greys as the dropdown lists: 50 selected and hovered,
                // 100 while pressed.
                bg={isSelected ? 'secondary.50' : undefined}
                aria-current={isSelected || undefined}
                onClick={() => onTabChange(index)}
                _hover={{
                  backgroundColor: 'secondary.50',
                  cursor: 'pointer',
                }}
                _active={{ backgroundColor: 'secondary.100' }}
              >
                <Text
                  title={option.name}
                  textStyle="body-2"
                  fontWeight={isSelected ? 500 : undefined}
                  color="base.content.strong"
                  noOfLines={2}
                  wordBreak="break-word"
                >
                  {option.name}
                </Text>
              </Flex>
            )
          })}
        </Box>

        {/* Right Panel --> Data Selector */}
        <Flex
          direction="column"
          w="66%"
          minW={0}
          position="relative"
          // Hints that the list scrolls.
          _after={{
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            h: 10,
            pointerEvents: 'none',
            bgGradient: 'linear(to-b, rgba(255,255,255,0), white)',
          }}
        >
          <Box flex={1} minH={0} overflowY="auto">
            {rightPanel}
          </Box>
        </Flex>
      </Flex>
    </Flex>
  )
}
