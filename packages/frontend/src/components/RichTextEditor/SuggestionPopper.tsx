import { useEffect, useRef, useState } from 'react'
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
  const [current, setCurrent] = useState<number>(0)

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
    <Flex w="100%" boxShadow="sm">
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
        <Box h={64} overflowY="auto">
          {data.map((option, index) => (
            <Text
              key={`primary-suggestion-${option.name}`}
              pl={4}
              py={3}
              bg={
                !!option.output?.length && current === index
                  ? 'secondary.100'
                  : undefined
              }
              textStyle="subhead-1"
              color="base.content.strong"
              onClick={() => setCurrent(index)}
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

      {/* Variables List */}
      <Box flexGrow={1} w="50%">
        <Text
          pt={4}
          px={4}
          pb={2}
          textStyle="subhead-1"
          color="base.content.medium"
        >
          Choose data
        </Text>
        <Divider borderColor="base.divider.medium" />
        {data.map((option, index) => (
          <Collapse
            key={`primary-suggestion-${option.name}-variables`}
            in={current === index}
            unmountOnExit
          >
            <VariablesList
              variables={option.output ?? []}
              onClick={onSuggestionClick}
            />
          </Collapse>
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

  const isEmpty = data.reduce(
    (acc, step) => acc && step.output.length === 0,
    true,
  )

  const offsetVerticalMargin = editorRef?.current?.offsetHeight ?? 0

  // fix issue for empty variables: only when popover placement is on top, no negative margin is needed
  const [placement, setPlacement] = useState('bottom') // default to bottom
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePlacement = () => {
    if (triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()

      // Deduce placement
      if (popoverRect.top <= triggerRect.top) {
        setPlacement('top')
      } else {
        setPlacement('bottom')
      }
    }
  }

  useEffect(() => {
    window.addEventListener('click', updatePlacement)
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement)

    // Clean up
    return () => {
      window.removeEventListener('click', updatePlacement)
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement)
    }
  }, [])

  if (!open) {
    return null
  }

  return (
    <Popover
      isOpen
      initialFocusRef={editorRef}
      gutter={0}
      offset={[0, offsetVerticalMargin + 1]} // this is adjusted based on DS input
    >
      <PopoverTrigger>
        <div ref={triggerRef} />
      </PopoverTrigger>
      {/* To account for window position when scrolling */}
      <PopoverContent
        width={editorRef?.current?.offsetWidth}
        ref={popoverRef}
        marginTop={
          isEmpty && placement === 'top'
            ? undefined
            : `-${offsetVerticalMargin}px`
        }
      >
        <Suggestions data={data} onSuggestionClick={onSuggestionClick} />
      </PopoverContent>
    </Popover>
  )
}
