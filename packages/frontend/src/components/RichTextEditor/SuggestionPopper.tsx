import { useState } from 'react'
import {
  Box,
  Collapse,
  Divider,
  Flex,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
} from '@chakra-ui/react'
import VariablesList from 'components/VariablesList'
import { StepWithVariables, Variable } from 'helpers/variables'

interface SuggestionsProps {
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

export default function Suggestions(props: SuggestionsProps) {
  const { data, onSuggestionClick = () => null } = props
  const [current, setCurrent] = useState<number | null>(0)

  const isEmpty = data.reduce(
    (acc, step) => acc && step.output.length === 0,
    true,
  )

  if (isEmpty) {
    return (
      <Text p={4} opacity={0.5} textStyle="body-1" color="base.content.medium">
        No variables available
      </Text>
    )
  }

  return (
    // max height = 256px (variable list) + 48px (from choose data)
    <Flex w="100%" maxH="304px" boxShadow="sm">
      {/* Select step to find variable list */}
      <Box flexGrow={1}>
        <Text
          pt={4}
          px={4}
          pb={2}
          textStyle="subhead-1"
          color="base.content.medium"
        >
          Use data from...
        </Text>
        <Divider borderColor="base.divider.medium" />
        <Box maxH="256px" overflowY="auto">
          {data.map((option, index) => (
            <div key={`primary-suggestion-${option.name}`}>
              <Text
                pl={4}
                py={3}
                bg={
                  !!option.output?.length && current === index
                    ? '#E9EAEE'
                    : undefined
                }
                textStyle="subhead-1"
                color="base.content.strong"
                onClick={() =>
                  setCurrent((currentIndex) =>
                    currentIndex === index ? null : index,
                  )
                }
                _hover={{
                  backgroundColor: '#F8F9FA',
                  cursor: 'pointer',
                }}
              >
                {option.name}
              </Text>
            </div>
          ))}
        </Box>
      </Box>

      <Box>
        <Divider orientation="vertical" borderColor="base.divider.medium" />
      </Box>

      {/* Variables List */}
      <Box flexGrow={1} maxW="50%">
        <Text
          pt={4}
          px={4}
          pb={2}
          textStyle="subhead-1"
          color="base.content.medium"
        >
          Choose Data
        </Text>
        <Divider borderColor="base.divider.medium" />
        {data.map((option, index) => (
          <div key={`primary-suggestion-${option.name}-variables`}>
            <Collapse in={current === index} unmountOnExit>
              <VariablesList
                variables={option.output ?? []}
                onClick={onSuggestionClick}
              />
            </Collapse>
          </div>
        ))}
      </Box>
    </Flex>
  )
}

interface SuggestionsPopperProps {
  open: boolean
  editorRef: React.MutableRefObject<HTMLDivElement | null>
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

export const SuggestionsPopper = (props: SuggestionsPopperProps) => {
  const { open, editorRef, data, onSuggestionClick } = props

  return (
    <Popover isOpen={open} initialFocusRef={editorRef}>
      <PopoverTrigger>
        <div />
      </PopoverTrigger>
      {/* To account for window position when scrolling */}
      <PopoverContent
        width={editorRef?.current?.offsetWidth}
        marginBottom={`calc(${editorRef?.current?.offsetHeight}px - 10px)`}
        marginTop="-10px"
      >
        <Suggestions data={data} onSuggestionClick={onSuggestionClick} />
      </PopoverContent>
    </Popover>
  )
}
