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

  const { variablesWithModal, variableListVariables } = useMemo(() => {
    if (!variables || variables.length === 0) {
      return {
        variablesWithModal: [],
        variableListVariables: [],
      }
    }

    const variablesWithModal = variables.filter(
      (v) => v.name.split('.').pop() === 'rows',
    )

    /**
     * NOTE (kevinkim-ogp): we can disable column names in the variable output to reduce confusion for users
     */
    const variableListVariables = [
      ...variables.filter(
        (v) =>
          v.name.split('.').pop() === 'rowsFound' || v.name.includes('columns'),
      ),
    ]

    return {
      variablesWithModal,
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
