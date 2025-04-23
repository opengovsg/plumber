import { IAction, IStep, ITrigger } from '@plumber/types'

import { useMemo } from 'react'
import { MdOpenInNew } from 'react-icons/md'
import { Box } from '@chakra-ui/react'

import { Variable } from '@/helpers/variables'

import { VariableItem } from '../VariablesList'

interface TestMultiRowResultProps {
  step: IStep
  selectedActionOrTrigger: ITrigger | IAction | undefined
  variables: Variable[] | null
  isMock?: boolean
  onModalOpen?: () => void
}

export default function MultiRowResultVariables(
  props: TestMultiRowResultProps,
): JSX.Element {
  const { step, variables, onModalOpen } = props

  const isRowsVar = (v: Variable) => v.name.split('.').pop() === 'rows'
  const isRowsFoundVar = (v: Variable) =>
    v.name.split('.').pop() === 'rowsFound'
  const isColumnsVar = (v: Variable) => v.name.includes('columns')

  const { variablesWithModal, variableListVariables } = useMemo(() => {
    if (!variables?.length) {
      return { variablesWithModal: [], variableListVariables: [] }
    }

    const rowsVariable = variables.find(isRowsVar)
    const rowsFoundVariable = variables.find(isRowsFoundVar)
    const numRowsFound = rowsFoundVariable?.value || 0

    const columnVariables = variables.filter(isColumnsVar)
    const rowsFoundVariables = variables.filter(isRowsFoundVar)

    const variableListVariables = [...rowsFoundVariables, ...columnVariables]

    if (numRowsFound === 0) {
      return {
        variablesWithModal: [],
        variableListVariables: rowsVariable
          ? [rowsVariable, ...variableListVariables]
          : variableListVariables,
      }
    }

    return {
      variablesWithModal: rowsVariable ? [rowsVariable] : [],
      variableListVariables,
    }
  }, [variables])

  if (step.status !== 'completed') {
    return <></>
  }

  // No data only happens if user hasn't executed yet, or step returned null.
  if (!variablesWithModal && !variableListVariables) {
    return <></>
  }

  return (
    <Box
      data-test="variable-suggestion-group"
      maxH={64}
      overflowY="auto"
      p="1rem"
    >
      {variablesWithModal.map((variable) => (
        <VariableItem
          key={`variable-${variable.name}`}
          variable={variable}
          onClick={onModalOpen}
          withIcon={MdOpenInNew}
        />
      ))}
      {variableListVariables.length > 0 &&
        variableListVariables
          .filter((v): v is Variable => 'label' in v && 'type' in v)
          .map((v) => (
            <VariableItem
              key={`variable-${v.name}`}
              variable={v}
              onClick={onModalOpen}
            />
          ))}
    </Box>
  )
}
