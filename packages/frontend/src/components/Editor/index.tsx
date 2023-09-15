import type { IFlow, IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { AbsoluteCenter, Box, Divider, Flex } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import FlowStep from 'components/FlowStep'
import { EditorContext } from 'contexts/Editor'
import { CREATE_STEP } from 'graphql/mutations/create-step'
import { UPDATE_STEP } from 'graphql/mutations/update-step'
import { GET_FLOW } from 'graphql/queries/get-flow'

interface AddStepButtonProps {
  onClick: () => void
  isDisabled: boolean
  isLastStep: boolean
}

function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const { onClick, isDisabled, isLastStep } = props

  return (
    <Box pos="relative" h={24}>
      {/* Top vertical line */}
      <Box h="1.875rem">
        <Divider orientation="vertical" borderColor="base.divider.strong" />
      </Box>
      {/* Bottom vertical line */}
      {!isLastStep && (
        <Box mt={9} h="1.875rem">
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        </Box>
      )}
      <AbsoluteCenter>
        <IconButton
          onClick={onClick}
          isDisabled={isDisabled}
          aria-label="Add Step"
          icon={<BiPlus />}
          variant="outline"
          size="xs"
        />
      </AbsoluteCenter>
    </Box>
  )
}

function updateHandlerFactory(flowId: string, previousStepId: string) {
  return function createStepUpdateHandler(cache: any, mutationResult: any) {
    const { data } = mutationResult
    const { createStep: createdStep } = data
    const { getFlow: flow } = cache.readQuery({
      query: GET_FLOW,
      variables: { id: flowId },
    })
    const steps = flow.steps.reduce((steps: any[], currentStep: any) => {
      if (currentStep.id === previousStepId) {
        return [...steps, currentStep, createdStep]
      }

      return [...steps, currentStep]
    }, [])

    cache.writeQuery({
      query: GET_FLOW,
      variables: { id: flowId },
      data: { getFlow: { ...flow, steps } },
    })
  }
}

type EditorProps = {
  flow: IFlow
}

export default function Editor(props: EditorProps): React.ReactElement {
  const [updateStep] = useMutation(UPDATE_STEP)
  const [createStep, { loading: creationInProgress }] = useMutation(
    CREATE_STEP,
    {
      refetchQueries: ['GetFlow'],
    },
  )

  const { flow } = props
  const [triggerStep] = flow.steps

  const [currentStepId, setCurrentStepId] = useState<string | null>(
    triggerStep.id,
  )

  const { readOnly: isReadOnlyEditor } = useContext(EditorContext)

  const onStepChange = useCallback(
    (step: IStep) => {
      const mutationInput: Record<string, unknown> = {
        id: step.id,
        key: step.key,
        parameters: step.parameters,
        connection: {
          id: step.connection?.id,
        },
        flow: {
          id: flow.id,
        },
      }

      if (step.appKey) {
        mutationInput.appKey = step.appKey
      }

      updateStep({
        variables: { input: mutationInput },
      })
    },
    [updateStep, flow.id],
  )

  const addStep = useCallback(
    async (previousStepId: string) => {
      const mutationInput = {
        previousStep: {
          id: previousStepId,
        },
        flow: {
          id: flow.id,
        },
      }

      const createdStep = await createStep({
        variables: { input: mutationInput },
        update: updateHandlerFactory(flow.id, previousStepId),
      })
      const createdStepId = createdStep.data.createStep.id

      setCurrentStepId(createdStepId)
    },
    [createStep, flow.id],
  )

  return (
    <Flex flexDir="column" alignItems="center" py={3}>
      {flow?.steps?.map((step, index, steps) => (
        <Fragment key={`${step.id}-${index}`}>
          <FlowStep
            key={step.id}
            step={step}
            index={index + 1}
            collapsed={currentStepId !== step.id}
            onOpen={() => setCurrentStepId(step.id)}
            onClose={() => setCurrentStepId(null)}
            onChange={onStepChange}
            onContinue={() => {
              setCurrentStepId(steps[index + 1]?.id)
            }}
          />

          <AddStepButton
            onClick={() => addStep(step.id)}
            isDisabled={creationInProgress || isReadOnlyEditor}
            isLastStep={index === steps.length - 1}
          />
        </Fragment>
      ))}
    </Flex>
  )
}
