import type { IFlow, IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  AbsoluteCenter,
  Box,
  CircularProgress,
  Divider,
  Flex,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import FlowStep from 'components/FlowStep'
import FlowStepGroup from 'components/FlowStepGroup'
import {
  StepExecutionsToIncludeContext,
  StepExecutionsToIncludeProvider,
} from 'contexts/StepExecutionsToInclude'
import { CREATE_STEP } from 'graphql/mutations/create-step'
import { UPDATE_STEP } from 'graphql/mutations/update-step'
import { GET_FLOW } from 'graphql/queries/get-flow'
import useApps from 'hooks/useApps'

interface AddStepButtonProps {
  onClick: () => void
  disabled: boolean
  isLastStep: boolean
}

function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const { onClick, disabled, isLastStep } = props

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
          disabled={disabled}
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
  steps: IStep[]
}

export default function Editor(props: EditorProps): React.ReactElement {
  const [updateStep] = useMutation(UPDATE_STEP)
  const [createStep, { loading: creationInProgress }] = useMutation(
    CREATE_STEP,
    {
      refetchQueries: ['GetFlow'],
    },
  )

  const { flow, steps } = props

  const [currentStepId, setCurrentStepId] = useState<string | null>(
    steps[0]?.id,
  )

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

  const apps = useApps()
  const [stepsBeforeGroup, groupedSteps] = useMemo(() => {
    const groupStepIdx = steps.findIndex((step, index) => {
      if (
        // We ignore the 1st step because it's either a trigger, or a
        // step-grouping action that is using a nested Editor to edit steps in
        // its group.
        index === 0 ||
        !step.appKey ||
        !step.key
      ) {
        return false
      }
      return (
        apps?.get(step.appKey)?.actions?.get(step.key)?.groupsLaterSteps ??
        false
      )
    })
    return groupStepIdx === -1
      ? [steps, []]
      : [steps.slice(0, groupStepIdx), steps.slice(groupStepIdx)]
  }, [
    apps,
    // updateHandlerFactory creates a new array, so referential equality is OK.
    // FIXME (ogp-weeloong): Maybe we can optimize our caching strategy to avoid
    // creating new arrays.
    steps,
  ])

  //
  // Compute which steps are eligible for variable extraction.
  //
  // Note:
  // We don't include grouped steps inside `stepExecutionsToInclude` by default,
  // since some groups may not want to extract variables from _all_ steps in the
  // group (e.g. If-then only wants to extract from steps in the current branch).
  //
  // Instead, we expect step-grouping actions to instantiate a nested Editor with
  // the appropriate subarray of steps in the group; we will then handle merging
  // stepExecutionsToInclude between the parent Editor and the nested Editor.
  //
  const parentStepExecutionsToInclude = useContext(
    StepExecutionsToIncludeContext,
  )
  const stepExecutionsToInclude = useMemo(
    () =>
      new Set([
        ...parentStepExecutionsToInclude,
        ...stepsBeforeGroup.map((step) => step.id),
      ]),
    [stepsBeforeGroup],
  )

  if (!apps) {
    return <CircularProgress isIndeterminate my={2} />
  }

  return (
    <Flex w="full" justifyContent="center">
      <Flex flexDir="column" alignItems="center" py={3} w="53.25rem">
        <StepExecutionsToIncludeProvider value={stepExecutionsToInclude}>
          {stepsBeforeGroup.map((step, index, steps) => (
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
                disabled={creationInProgress || flow.active}
                isLastStep={
                  groupedSteps.length === 0 && index === steps.length - 1
                }
              />
            </Fragment>
          ))}
          {groupedSteps.length > 0 && (
            <FlowStepGroup
              flow={flow}
              steps={groupedSteps}
              collapsed={currentStepId !== groupedSteps[0].id}
              onOpen={() => setCurrentStepId(groupedSteps[0].id)}
              onClose={() => setCurrentStepId(null)}
            />
          )}
        </StepExecutionsToIncludeProvider>
      </Flex>
    </Flex>
  )
}
