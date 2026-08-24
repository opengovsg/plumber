import { Box, Collapse, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import type { IAction, IStep, ITrigger } from '@plumber/types'
import { useContext } from 'react'

import VariablesList from '@/components/VariablesList'
import { EditorContext } from '@/contexts/Editor'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import type { Variable } from '@/helpers/variables'

import { getForEachDataMessage } from './utils'

function getNoOutputMessage(
  selectedActionOrTrigger: TestResultsProps['selectedActionOrTrigger'],
): string | null {
  // Type guard for ITrigger
  if (
    !selectedActionOrTrigger ||
    !('webhookTriggerInstructions' in selectedActionOrTrigger)
  ) {
    return null
  }

  return selectedActionOrTrigger?.webhookTriggerInstructions?.errorMsg ?? null
}

interface TestResultsProps {
  step: IStep
  selectedActionOrTrigger: ITrigger | IAction | undefined
  // if null, the step probably hasnt been tested yet
  variables: Variable[] | null
  isMock?: boolean
  isOpen: boolean
  isIfThenStep?: boolean
  onModalOpen?: () => void
}

export default function TestResult(props: TestResultsProps): JSX.Element {
  const {
    selectedActionOrTrigger,
    variables,
    isMock = false,
    isOpen,
    isIfThenStep,
    step,
  } = props

  const { testExecutionSteps } = useContext(EditorContext)
  const isForEachStep = step.key === TOOLBOX_ACTIONS.ForEach

  const testResultMessage = isForEachStep
    ? getForEachDataMessage(testExecutionSteps, step)
    : isMock
      ? 'The mock responses below are based on your form fields.'
      : null

  const Content = () => {
    // No data only happens if user hasn't executed yet, or step returned null.
    if (!variables?.length) {
      return (
        <Infobox variant="warning" width="full">
          <Box>
            <Text fontWeight="600">{`We couldn't find any data from your last test`}</Text>
            <Text mt={0.5}>{getNoOutputMessage(selectedActionOrTrigger)}</Text>
          </Box>
        </Infobox>
      )
    }

    if (isIfThenStep) {
      return null
    }

    return (
      <Box w="100%">
        {testResultMessage && (
          <Infobox variant="info">
            <Text>{testResultMessage}</Text>
          </Infobox>
        )}
        <VariablesList variables={variables} customStyles={{ py: 0, px: 2 }} />
      </Box>
    )
  }

  return (
    <Collapse
      in={isOpen}
      transition={{
        enter: {
          type: false,
        },
        exit: {
          type: false,
        },
      }}
      style={{
        width: '100%',
        marginTop: 0,
        border: '1px solid',
        borderColor: '#EDEDED',
        borderTop: 'none',
        borderStartStartRadius: 0,
        borderStartEndRadius: 0,
        borderEndStartRadius: 8,
        borderEndEndRadius: 8,
      }}
    >
      <Box w="100%">
        <Content />
      </Box>
    </Collapse>
  )
}
