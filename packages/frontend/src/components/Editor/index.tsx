import type { IApp, IFlow, IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { Center, Flex, useDisclosure } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import EditorRightDrawer from '@/components/EditorRightDrawer'
import FlowStep from '@/components/FlowStep'
import FlowStepGroup from '@/components/FlowStepGroup'
import { EditorContext } from '@/contexts/Editor'
import {
  StepExecutionsToIncludeContext,
  StepExecutionsToIncludeProvider,
} from '@/contexts/StepExecutionsToInclude'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import { AddStepButton } from './AddStepButton'

// FIXME (kevinkim-ogp): this is a temporary fix for the scrollbar
// find a better way to get the max height
export const EDITOR_MAX_HEIGHT = 'calc(100vh - 61px)'

type EditorProps = {
  flow: IFlow
  steps: IStep[]
}

export default function Editor(props: EditorProps): React.ReactElement {
  const [updateStep] = useMutation(UPDATE_STEP)
  const isMobile = useIsMobile()
  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure()

  const { flow, steps: rawSteps } = props

  const {
    readOnly: isReadOnlyEditor,
    currentStepId,
    onUpdateStep,
    setCurrentStepId,
    allApps,
  } = useContext(EditorContext)

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

  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(0)

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

  const appsWithActions: IApp[] = allApps.filter(
    (app: IApp) => !!app.actions?.length,
  )

  const groupingActions = useMemo(() => {
    if (!appsWithActions) {
      return null
    }

    return new Set(
      appsWithActions?.flatMap((app) =>
        app.actions
          ?.filter((action) => action.groupsLaterSteps)
          ?.map((action) => `${app.key}-${action.key}`),
      ) ?? [],
    )
  }, [appsWithActions])

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
    return appsWithActions.find((app) => app.key === groupedSteps[0].appKey)
      ?.iconUrl
  }, [appsWithActions, groupedSteps])

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

  const nonIfThenActionSteps = stepsBeforeGroup.filter(
    (step) =>
      step.type === 'action' &&
      step.appKey !== TOOLBOX_APP_KEY &&
      step.key !== TOOLBOX_ACTIONS.IfThen,
  )
  // Disables last add step and hide in-between add step buttons
  const hasExactlyOneEmptyActionStep =
    nonIfThenActionSteps.length === 1 && !nonIfThenActionSteps[0].appKey

  // Disables last add step button but show empty action instead
  const hasNoActionSteps = nonIfThenActionSteps.length === 0

  if (!appsWithActions || !groupingActions) {
    return (
      <Center height="100vh" position="fixed" width="full" top={0} left={0}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  return (
    <Flex w="full" justifyContent={isDrawerOpen ? 'space-between' : 'center'}>
      <Flex
        flexDir="column"
        alignItems="center"
        py={3}
        px={isDrawerOpen ? (isMobile ? 0 : '5rem') : 0}
        w={isDrawerOpen ? (isMobile ? '0px' : undefined) : '53.25rem'}
        flex={isDrawerOpen ? (isMobile ? 0 : 1) : undefined}
        maxW="full"
        transition="width 0.3s ease-in-out, transform 0.3s ease-in-out"
        maxHeight={EDITOR_MAX_HEIGHT}
        overflowY={isDrawerOpen ? 'auto' : undefined}
      >
        <StepExecutionsToIncludeProvider value={stepExecutionsToInclude}>
          {stepsBeforeGroup.map((step, index) => {
            return (
              <Fragment key={`${step.id}-${index}`}>
                <FlowStep
                  step={step}
                  isLastStep={index === steps.length - 1}
                  index={index + 1}
                  collapsed={
                    !isDrawerOpen && currentStepId === step.id
                      ? true
                      : currentStepId !== step.id
                  }
                  onOpen={() => {
                    setCurrentStepId(step.id)
                    onDrawerOpen()
                  }}
                  onClose={() => {
                    setCurrentStepId(null)
                    onDrawerClose()
                  }}
                  onChange={onUpdateStep}
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
                  // hide all add button steps if is readonly
                  isHidden={isReadOnlyEditor}
                  // show empty action if no action step exists
                  showEmptyAction={hasNoActionSteps && !groupedSteps.length}
                  // Disable add button steps if first action is not set up
                  isDisabled={
                    (hasExactlyOneEmptyActionStep || hasNoActionSteps) &&
                    !groupedSteps.length
                  }
                  isLastStep={index === steps.length - 1}
                  stepId={step.id}
                />
              </Fragment>
            )
          })}
          {groupedSteps.length > 0 && (
            <FlowStepGroup
              iconUrl={flowStepGroupIconUrl}
              flow={flow}
              steps={groupedSteps}
              collapsed={currentStepId !== groupedSteps[0].id}
              onOpen={() => setCurrentStepId(groupedSteps[0].id)}
              onClose={() => setCurrentStepId(null)}
            />
          )}
        </StepExecutionsToIncludeProvider>
      </Flex>
      <EditorRightDrawer
        flow={flow}
        flowStepGroupIconUrl={flowStepGroupIconUrl}
        index={currentStepIndex}
        isDrawerOpen={isDrawerOpen}
        isLastStep={currentStepIndex === steps.length - 1}
        onDrawerClose={onDrawerClose}
        onDrawerOpen={onDrawerOpen}
        onStepChange={onStepChange}
        currentStepId={currentStepId}
        currentStepIndex={currentStepIndex}
        groupedSteps={groupedSteps}
        setCurrentStepId={setCurrentStepId}
        setCurrentStepIndex={setCurrentStepIndex}
        steps={steps}
      />
    </Flex>
  )
}
