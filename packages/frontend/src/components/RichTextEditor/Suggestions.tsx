import { memo, useState } from 'react'
import { Collapse, Text } from '@chakra-ui/react'

import VariablesList from '@/components/VariablesList'
import { StepWithVariables, Variable } from '@/helpers/variables'

import SuggestionsWrapper from '../SuggestionsWrapper'

interface SuggestionsProps {
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

function Suggestions(props: SuggestionsProps) {
  const { data, onSuggestionClick = () => null } = props
  const [current, setCurrent] = useState<number>(0)

  const isEmpty = data.reduce(
    (acc, step) => acc && step.output.length === 0,
    true,
  )

  if (isEmpty) {
    return (
      <Text p={4} opacity={0.5} textStyle="body-1" color="base.content.medium">
        No variables available - complete earlier steps to use them here
      </Text>
    )
  }

  return (
    <SuggestionsWrapper
      suggestionType="variables"
      leftPanelData={data}
      currentTab={current}
      onTabChange={setCurrent}
      rightPanel={data.map((option, index) => (
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
    />
  )
}

export default memo(Suggestions)
