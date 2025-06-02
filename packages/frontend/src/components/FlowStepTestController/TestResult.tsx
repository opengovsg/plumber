import type { IAction, IStep, ITrigger } from '@plumber/types'

import { Box, Collapse, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import VariablesList from '@/components/VariablesList'
import type { Variable } from '@/helpers/variables'

import MultiRowResultVariables from '../MultiRowResultVariables'
import { isMultiRowStep } from '../MultiRowResultVariables/utils'

import { getIfThenOutput } from './utils'

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

function getMockDataMessage(
  selectedActionOrTrigger: TestResultsProps['selectedActionOrTrigger'],
): string | null {
  // Type guard for ITrigger
  if (
    !selectedActionOrTrigger ||
    !('webhookTriggerInstructions' in selectedActionOrTrigger)
  ) {
    return null
  }

  return (
    selectedActionOrTrigger?.webhookTriggerInstructions?.mockDataMsg ?? null
  )
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
    onModalOpen,
  } = props

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
      const isConditionMet = variables?.[0]?.value as boolean
      const [variant, message] = getIfThenOutput(isConditionMet, step.id)
      return (
        <Infobox variant={variant} width="full">
          <Box>{message}</Box>
        </Infobox>
      )
    }

    return (
      <Box w="100%">
        {isMock && (
          <Infobox variant="info">
            <Text>{getMockDataMessage(selectedActionOrTrigger)}</Text>
          </Infobox>
        )}
        {isMultiRowStep(step) ? (
          <MultiRowResultVariables
            step={step}
            selectedActionOrTrigger={selectedActionOrTrigger}
            variables={variables}
            onModalOpen={onModalOpen}
          />
        ) : (
          <VariablesList
            variables={variables}
            customStyles={{ py: 0, px: 2 }}
          />
        )}
      </Box>
    )
  }

  return (
    <Collapse
      in={isOpen}
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
