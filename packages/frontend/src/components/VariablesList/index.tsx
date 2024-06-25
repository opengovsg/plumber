import type { MouseEvent } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { type Variable } from 'helpers/variables'

export type VariableClickCallback = (
  variable: Variable,
  mouseEvent: MouseEvent<HTMLDivElement>,
) => void

function makeVariableComponent(
  variable: Variable,
  onClick?: VariableClickCallback,
): JSX.Element {
  return (
    <Box
      key={`suggestion-${variable.name}`}
      data-test="variable-suggestion-item"
      padding={onClick ? '0.5rem 1rem' : '1rem'}
      borderBottom={onClick ? undefined : '1px solid #EDEDED'}
      _hover={
        onClick
          ? {
              backgroundColor: 'secondary.50',
              cursor: 'pointer',
            }
          : undefined
      }
      _active={
        onClick
          ? {
              backgroundColor: 'secondary.100',
              cursor: 'pointer',
            }
          : undefined
      }
      // onClick doesn't work sometimes due to latency between mousedown and immediate mouseup event after
      onMouseDown={
        onClick
          ? (event) => {
              onClick(variable, event)
            }
          : undefined
      }
    >
      <Text textStyle="body-1" color="base.content.strong">
        {variable.label ?? variable.name}
      </Text>
      <Text textStyle="body-2" color="base.content.medium">
        {variable.displayedValue ?? variable.value?.toString() ?? ''}
      </Text>
    </Box>
  )
}

interface VariablesListProps {
  variables: Variable[]
  onClick?: VariableClickCallback
}

export default function VariablesList(props: VariablesListProps) {
  const { variables, onClick } = props

  if (!variables || variables.length === 0) {
    return <></>
  }

  return (
    <Box
      data-test="variable-suggestion-group"
      maxH={64}
      overflowY="auto"
      p={onClick ? undefined : '1rem'}
    >
      {variables.map((variable) => makeVariableComponent(variable, onClick))}
    </Box>
  )
}
