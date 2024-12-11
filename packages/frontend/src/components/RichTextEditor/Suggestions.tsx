import { memo, useMemo, useState } from 'react'
import { Box, Collapse, Divider, Flex, Text } from '@chakra-ui/react'

import VariablesList from '@/components/VariablesList'
import { StepWithVariables, Variable } from '@/helpers/variables'

interface SuggestionsProps {
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable, checked?: boolean) => void
  variableComponentType?: 'checkbox' | 'list'
  checkedItems?: unknown[]
  accept?: string
  processFile?: (file: File) => void
  onDelete?: (event: React.MouseEvent, file: Variable) => void
}

function Suggestions(props: SuggestionsProps) {
  const { data, onSuggestionClick = () => null, ...rest } = props
  const [current, setCurrent] = useState<number>(0)

  const allowAddNew = data.some((step) => step.addNew)
  const isEmpty = data.reduce(
    (acc, step) => acc && step.output.length === 0,
    true,
  )

  const filteredData = useMemo(() => {
    return data.filter((option) => option.output.length !== 0 || option.addNew)
  }, [data])

  if (isEmpty && !allowAddNew) {
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
          {filteredData.map((option, index) => {
            const { addNew, output } = option
            return (
              (!!output?.length || addNew) && (
                <Text
                  key={`primary-suggestion-${option.name}`}
                  pl={4}
                  py={3}
                  bg={
                    (!!output?.length || addNew) && current === index
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
              )
            )
          })}
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
        {filteredData.map((option, index) => {
          const { addNew, output } = option
          return (
            (!!output?.length || addNew) && (
              <Collapse
                key={`primary-suggestion-${option.name}-variables`}
                in={current === index}
                unmountOnExit
              >
                <VariablesList
                  id={option.id}
                  variables={option.output ?? []}
                  onClick={onSuggestionClick}
                  addNew={option.addNew}
                  allowDelete={option.addNew}
                  {...rest}
                />
              </Collapse>
            )
          )
        })}
      </Box>
    </Flex>
  )
}

export default memo(Suggestions)
