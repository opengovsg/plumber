import type { IAction, IStep, ITrigger } from '@plumber/types'

import { Box, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import VariablesList from '@/components/VariablesList'
import { isIfThenStep } from '@/helpers/toolbox'
import type { Variable } from '@/helpers/variables'

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
}

export default function TestResult(props: TestResultsProps): JSX.Element {
  const { step, selectedActionOrTrigger, variables, isMock = false } = props

  // No data only happens if user hasn't executed yet, or step returned null.
  if (!variables?.length) {
    if (step.status !== 'completed') {
      return <></>
    }
    return (
      <Infobox variant="warning" width="full">
        <Box>
          <Text fontWeight="600">{`We couldn't find any data from your last test`}</Text>
          <Text mt={0.5}>{getNoOutputMessage(selectedActionOrTrigger)}</Text>
        </Box>
      </Infobox>
    )
  }

  // Edge case for If-then
  //
  // FIXME (ogp-weeloong): Revamp UI to allow special handling for
  // toolbox actions in an isolated codepath.
  if (isIfThenStep(step)) {
    const isConditionMet = variables[0].value as boolean

    if (isConditionMet) {
      return (
        <Infobox variant="success" w="full">
          <Text>
            Based on your sample data, it meets the conditions that you have set
            up and your pipe <Text as="b">would have</Text> continued.
          </Text>
        </Infobox>
      )
    } else {
      return (
        <Infobox variant="warning" w="full">
          <Text>
            Based on your sample data, it does not meet the conditions you have
            set up and your pipe <Text as="b">would not have</Text> continued.
          </Text>
        </Infobox>
      )
    }
  }

  return (
    <Box w="100%">
      <Infobox variant="success">
        <Text>
          {isMock && getMockDataMessage(selectedActionOrTrigger)}
          {
            ' You can use the data below as variables in your action steps below.'
          }
        </Text>
      </Infobox>
      <VariablesList variables={variables} />
    </Box>
  )
}
