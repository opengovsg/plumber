import type { IAction, IStep, ITrigger } from '@plumber/types'

import { Box, Link, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import VariablesList from 'components/VariablesList'
import { isIfThenStep } from 'helpers/toolbox'
import { type StepWithVariables } from 'helpers/variables'

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
  stepsWithVariables: StepWithVariables[]
  isExecuted: boolean
}

export default function TestResult(props: TestResultsProps): JSX.Element {
  const { step, selectedActionOrTrigger, stepsWithVariables, isExecuted } =
    props

  // No data only happens if user hasn't executed yet, or step returned null.
  if (stepsWithVariables.length == 0) {
    if (isExecuted) {
      return (
        <Infobox variant="warning" width="full">
          <Box>
            <Text fontWeight="600">{`We couldn't find any test data`}</Text>
            <Text mt={0.5}>{getNoOutputMessage(selectedActionOrTrigger)}</Text>
          </Box>
        </Infobox>
      )
    } else {
      return <></>
    }
  }

  // Paranoia, because all code after assumes that only 1 step was run.
  if (stepsWithVariables.length > 1) {
    return (
      <Infobox variant="error" w="full">
        <Text>
          An unexpected error occurred, please contact{' '}
          <Link href="mailto:support@plumber.gov.sg">
            support@plumber.gov.sg
          </Link>{' '}
          for help!
        </Text>
      </Infobox>
    )
  }

  // Edge case for If-then
  //
  // FIXME (ogp-weeloong): Revamp UI to allow special handling for
  // toolbox actions in an isolated codepath.
  if (isIfThenStep(step)) {
    const isConditionMet = stepsWithVariables[0].output[0].value as boolean

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
          You can use the data below as variables in your action steps below.
        </Text>
      </Infobox>
      <Box maxH="25rem" overflowY="scroll" w="100%">
        <VariablesList variables={stepsWithVariables[0].output} />
      </Box>
    </Box>
  )
}
