import type { IApp, IFlow, IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { Center, Flex } from '@chakra-ui/react'

import EditorRightDrawer from '@/components/EditorRightDrawer'
import FlowStep from '@/components/FlowStep'
import FlowStepGroup from '@/components/FlowStepGroup'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsToIncludeProvider } from '@/contexts/StepExecutionsToInclude'
import {
  extractBranchesWithSteps,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import { AddStepButton } from './AddStepButton'
import { editorStyles } from './styles'

type EditorProps = {
  flow: IFlow
  steps: IStep[]
  isNested?: boolean
}

export default function Editor(props: EditorProps): React.ReactElement {
  const { flow, steps: rawSteps, isNested } = props

  const {
    allApps,
    readOnly: isReadOnlyEditor,
    isDrawerOpen,
    isMobile,
    currentStepId,
    currentStepIndex,
    onDrawerClose,
    onDrawerOpen,
    onUpdateStep,
    setCurrentStepId,
    setCurrentStepIndex,
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

    let branchesWithSteps: IStep[][] = []
    if (groupStepIdx !== -1) {
      branchesWithSteps = extractBranchesWithSteps(steps.slice(groupStepIdx), 0)
    }

    return groupStepIdx === -1
      ? [steps, []]
      : [steps.slice(0, groupStepIdx), branchesWithSteps]
  }, [groupingActions, steps])

  const flowStepGroupIconUrl = useMemo(() => {
    if (groupedSteps.length === 0) {
      return undefined
    }
    return appsWithActions.find((app) => app.key === groupedSteps[0][0].appKey)
      ?.iconUrl
  }, [appsWithActions, groupedSteps])

  //
  // Compute which steps are eligible for variable extraction.
  //
  // Note:
  // we include some grouped steps as there is no longer a nested editor
  // we identify the group by checking if the current step id is in the group
  //
  const groupStepsToInclude = useMemo(
    () =>
      groupedSteps.filter((group) =>
        group.some((step) => step.id === currentStepId),
      ),
    [currentStepId, groupedSteps],
  )

  const stepExecutionsToInclude = useMemo(
    () =>
      new Set([
        ...stepsBeforeGroup.map((step) => step.id),
        ...groupStepsToInclude.flatMap((step) => step.map((s) => s.id)),
      ]),
    [stepsBeforeGroup, groupStepsToInclude],
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

  const getStepPadding = () => {
    if (isDrawerOpen) {
      if (isMobile) {
        return 0
      }
      return '5rem'
    }
    return 0
  }

  return (
    <Flex w="full" justifyContent={isDrawerOpen ? 'space-between' : 'center'}>
      <StepExecutionsToIncludeProvider value={stepExecutionsToInclude}>
        <Flex
          {...editorStyles.container}
          flex={isDrawerOpen ? (isMobile ? 0 : 1) : undefined}
          px={getStepPadding()}
        >
          {stepsBeforeGroup.map((step, index) => (
            <Fragment key={`${step.id}-${index}`}>
              <FlowStep
                step={step}
                isDeletable={true}
                isLastStep={index === steps.length - 1}
                isNested={isNested}
                index={index + 1}
                collapsed={
                  !isDrawerOpen && currentStepId === step.id
                    ? true
                    : currentStepId !== step.id
                }
                onOpen={() => {
                  setCurrentStepId(step.id)
                  setCurrentStepIndex(index)
                  onDrawerOpen()
                }}
                onClose={() => {
                  setCurrentStepId(null)
                  setCurrentStepIndex(null)
                  onDrawerClose()
                }}
                onChange={onUpdateStep}
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
          ))}
          {groupedSteps.length > 0 && (
            <FlowStepGroup
              stepsBeforeGroup={stepsBeforeGroup}
              groupedSteps={groupedSteps}
            />
          )}
        </Flex>

        <EditorRightDrawer
          flow={flow}
          flowStepGroupIconUrl={flowStepGroupIconUrl}
          index={currentStepIndex}
          isLastStep={currentStepIndex === steps.length - 1}
          steps={steps}
        />
      </StepExecutionsToIncludeProvider>
    </Flex>
  )
}
