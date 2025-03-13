import type { IApp, IFlow, IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo, useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useMutation, useQuery } from '@apollo/client'
import {
  AbsoluteCenter,
  Box,
  Center,
  CircularProgress,
  Divider,
  Flex,
  useDisclosure,
} from '@chakra-ui/react'
import { IconButton, TouchableTooltip } from '@opengovsg/design-system-react'
import { Rating } from 'lens-widget'

import FlowStep from '@/components/FlowStep'
import FlowStepGroup from '@/components/FlowStepGroup'
import appConfig from '@/config/app'
import { EditorContext } from '@/contexts/Editor'
import {
  StepExecutionsToIncludeContext,
  StepExecutionsToIncludeProvider,
} from '@/contexts/StepExecutionsToInclude'
import client from '@/graphql/client'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'
import useAuthentication from '@/hooks/useAuthentication'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

interface AddStepButtonProps {
  onCreateStep: (appKey: string, eventKey: string) => Promise<IStep>
  isHidden: boolean
  isLastStep: boolean
}

function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const { onCreateStep, isHidden, isLastStep } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  if (isHidden) {
    return (
      <Box pos="relative" h={24} py={2}>
        {/* dont show line if last step, leave box for padding */}
        {!isLastStep && (
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        )}
      </Box>
    )
  }

  return (
    <>
      <Box pos="relative" h={24}>
        {/* Top vertical line */}
        <Box mt={2} h={5}>
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        </Box>
        {/* Bottom vertical line */}
        {!isLastStep && (
          <Box mt={10} h={5}>
            <Divider orientation="vertical" borderColor="base.divider.strong" />
          </Box>
        )}
        <AbsoluteCenter display={isHidden ? 'none' : 'flex'}>
          <TouchableTooltip label={'Insert step'} placement="right">
            <IconButton
              onClick={onOpen}
              aria-label="Add Step"
              icon={<BiPlus />}
              variant={isLastStep ? 'outline' : 'clear'}
              size="xs"
              color="interaction.sub.default"
              borderRadius="full"
              _hover={{
                bg: 'interaction.muted.neutral.hover',
              }}
              _active={{
                bg: 'interaction.muted.neutral.active',
              }}
              borderColor={isLastStep ? 'interaction.sub.default' : undefined}
            />
          </TouchableTooltip>
        </AbsoluteCenter>
      </Box>

      {/* Prevent unnecessary renders */}
      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false} // Can only add an action all the time
          isLastStep={isLastStep}
          onCreateStep={onCreateStep}
        />
      )}
    </>
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

    // getFlow requires certain attributes to be returned
    const completeCreatedStep = {
      ...createdStep,
      iconUrl: null,
      webhookUrl: null,
      config: {
        templateConfig: {
          appEventKey: null,
        },
      },
      createdAt: new Date().toISOString(),
    }

    const steps = flow.steps.reduce((steps: any[], currentStep: any) => {
      if (currentStep.id === previousStepId) {
        return [...steps, currentStep, completeCreatedStep]
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
    { refetchQueries: [GET_FLOW] },
  )
  const [initializeIfThen] = useIfThenInitializer()

  const { flow, steps: rawSteps } = props
  const showSurvey = flow.active && flow.config?.showSurvey
  const { currentUser } = useAuthentication()

  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const onFlowConfigUpdate = useCallback(async () => {
    await updateFlowConfig({
      variables: { input: { id: flow.id, showSurvey: false } },
    })
  }, [updateFlowConfig, flow.id])

  const steps = useMemo(
    // Populate each step's flowId so that IStep isn't LYING about flowId being
    // non-undefined. We do it here instead of fetching in GraphQL since all
    // steps have same pipe, so a bit wasteful to repeat this data over the wire.
    () =>
      rawSteps.map((step) => ({
        ...step,
        flow,
        flowId: flow.id,
      })),
    [flow, rawSteps],
  )

  const [currentStepId, setCurrentStepId] = useState<string | null>(
    steps[0]?.id,
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

  // Add a step to the flow with the given appKey and eventKey
  const addStep = useCallback(
    async (previousStepId: string, appKey: string, eventKey: string) => {
      const mutationInput = {
        previousStep: {
          id: previousStepId,
        },
        flow: {
          id: flow.id,
        },
        appKey,
        key: eventKey,
      }

      const createdStep = await createStep({
        variables: { input: mutationInput },
        update: updateHandlerFactory(flow.id, previousStepId),
      })

      const newStep = createdStep.data.createStep
      setCurrentStepId(newStep.id)

      // account for the if-then edge case
      if (appKey === TOOLBOX_APP_KEY && eventKey === TOOLBOX_ACTIONS.IfThen) {
        // Get the complete step data from the cache
        const { getFlow: updatedFlow } = client.readQuery({
          query: GET_FLOW,
          variables: { id: flow.id },
        })

        const completeStep = updatedFlow.steps.find(
          (s: IStep) => s.id === newStep.id,
        )

        if (completeStep) {
          const completeStepWithFlow = {
            ...completeStep,
            flow,
            flowId: flow.id,
          }
          return await initializeIfThen(completeStepWithFlow)
        }
      }

      return newStep as IStep
    },
    [createStep, flow, initializeIfThen],
  )

  // FIXME (ogp-weeloong): optimize this a bit further by omitting query.
  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter(
    (app: IApp) => !!app.actions?.length,
  )

  const groupingActions = useMemo(() => {
    if (!apps) {
      return null
    }

    return new Set(
      apps?.flatMap((app) =>
        app.actions
          ?.filter((action) => action.groupsLaterSteps)
          ?.map((action) => `${app.key}-${action.key}`),
      ) ?? [],
    )
  }, [apps])

  const [stepsBeforeGroup, groupedSteps] = useMemo(() => {
    if (!groupingActions) {
      return [[], []]
    }

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
      return groupingActions.has(`${step.appKey}-${step.key}`)
    })
    return groupStepIdx === -1
      ? [steps, []]
      : [steps.slice(0, groupStepIdx), steps.slice(groupStepIdx)]
  }, [
    groupingActions,
    // updateHandlerFactory creates a new array, so referential equality is OK.
    // FIXME (ogp-weeloong): Maybe we can optimize our caching strategy to avoid
    // creating new arrays.
    steps,
  ])
  const flowStepGroupIconUrl = useMemo(() => {
    if (groupedSteps.length === 0) {
      return undefined
    }
    return apps.find((app) => app.key === groupedSteps[0].appKey)?.iconUrl
  }, [apps, groupedSteps])

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
    [parentStepExecutionsToInclude, stepsBeforeGroup],
  )

  // Only affects editor when there are 2 steps: This works inside the If-Then editor too
  const isTriggerOrActionAbsent =
    steps.length === 2 &&
    (steps[0].appKey === null ||
      steps[0].key === null ||
      steps[1].appKey === null ||
      steps[1].key === null)

  if (!apps) {
    return (
      <Center w="full" h="100vh">
        <CircularProgress isIndeterminate my={2} />
      </Center>
    )
  }

  return (
    <Flex w="full" justifyContent="center">
      <Flex
        flexDir="column"
        alignItems="center"
        py={3}
        w="53.25rem"
        maxW="full"
      >
        <StepExecutionsToIncludeProvider value={stepExecutionsToInclude}>
          {stepsBeforeGroup.map((step, index) => (
            <Fragment key={`${step.id}-${index}`}>
              <FlowStep
                step={step}
                isLastStep={index === steps.length - 1}
                index={index + 1}
                collapsed={currentStepId !== step.id}
                onOpen={() => setCurrentStepId(step.id)}
                onClose={() => setCurrentStepId(null)}
                onChange={onStepChange}
                onContinue={() => {
                  if (
                    index === stepsBeforeGroup.length - 1 &&
                    groupedSteps.length > 0
                  ) {
                    setCurrentStepId(groupedSteps[0].id)
                  } else {
                    setCurrentStepId(stepsBeforeGroup[index + 1]?.id)
                  }
                }}
                templateConfig={flow?.config?.templateConfig}
              />
              <AddStepButton
                isHidden={
                  creationInProgress ||
                  isReadOnlyEditor ||
                  isTriggerOrActionAbsent
                }
                onCreateStep={async (appKey, eventKey) =>
                  await addStep(step.id, appKey, eventKey)
                }
                isLastStep={index === steps.length - 1}
              />
            </Fragment>
          ))}
          {groupedSteps.length > 0 && (
            <FlowStepGroup
              iconUrl={flowStepGroupIconUrl}
              flow={flow}
              steps={groupedSteps}
              collapsed={currentStepId !== groupedSteps[0].id}
              onOpen={() => setCurrentStepId(groupedSteps[0].id)}
              onClose={() => setCurrentStepId(null)}
              setCurrentStepId={setCurrentStepId}
            />
          )}
        </StepExecutionsToIncludeProvider>
      </Flex>

      {showSurvey && (
        <Rating
          clientKey={appConfig.lensSurveyClientKey}
          brandColour="#cf1a68"
          attributes={[
            `FlowId: ${flow.id}`,
            `UserEmail: ${currentUser?.email}`,
          ]}
          onSubmit={onFlowConfigUpdate}
          onClose={onFlowConfigUpdate}
        />
      )}
    </Flex>
  )
}
