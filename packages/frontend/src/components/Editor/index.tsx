import type { IApp, IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { Center, Flex } from '@chakra-ui/react'

import EditorRightDrawer from '@/components/EditorRightDrawer'
import FlowStep from '@/components/FlowStep'
import FlowStepGroup from '@/components/FlowStepGroup'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsToIncludeProvider } from '@/contexts/StepExecutionsToInclude'
import { extractBranchesWithSteps, TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import { AddStepButton } from './AddStepButton'
import { EDITOR_RIGHT_DRAWER_WIDTH } from './constants'
import { editorStyles } from './styles'

type EditorProps = {
  isNested?: boolean
}

export default function Editor(props: EditorProps): React.ReactElement {
  const { isNested } = props

  const {
    allApps,
    readOnly: isReadOnlyEditor,
    isDrawerOpen,
    isMobile,
    currentStepId,
    currentStepIndex,
    flow,
  } = useContext(EditorContext)

  const rawSteps = flow.steps
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
  // Mainly for if-then branches where we do not want to include steps
  // from other branches.
  //
  // Note:
  // - we include some grouped steps as there is no longer a nested editor
  // - we identify the group by checking if the current step id is in the group
  // - for-each steps are always included
  const groupStepsToInclude = useMemo(() => {
    return groupedSteps.flatMap((group) =>
      group.some((step) => step.id === currentStepId) ||
      group.some((step) => step.key === TOOLBOX_ACTIONS.ForEach)
        ? group
        : [],
    )
  }, [currentStepId, groupedSteps])

  const stepExecutionsToInclude = useMemo(
    () =>
      new Set([
        ...stepsBeforeGroup.map((step) => step.id),
        ...groupStepsToInclude.map((s) => s.id),
      ]),
    [stepsBeforeGroup, groupStepsToInclude],
  )

  const nonIfThenActionSteps = stepsBeforeGroup.filter(
    (step) => step.type === 'action' && step.key !== TOOLBOX_ACTIONS.IfThen,
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

  const leftStepPadding = isDrawerOpen ? (isMobile ? 0 : '5rem') : 0
  const rightDrawerTransform = isDrawerOpen
    ? 'translateX(0)'
    : 'translateX(100%)'
  const rightDrawerWidth = isDrawerOpen
    ? isMobile
      ? '100vw'
      : EDITOR_RIGHT_DRAWER_WIDTH
    : '0'

  return (
    <Flex
      {...editorStyles.editorWrapper}
      sx={{
        backgroundImage: 'radial-gradient(#f5f5f5 2px, transparent 2px)',
        backgroundSize: '30px 30px',
      }}
    >
      <StepExecutionsToIncludeProvider value={stepExecutionsToInclude}>
        <Flex
          {...editorStyles.stepHeaderContainer}
          flex={isDrawerOpen ? (isMobile ? 0 : 1) : undefined}
          px={leftStepPadding}
          maxWidth={`calc(100% - ${
            isDrawerOpen ? EDITOR_RIGHT_DRAWER_WIDTH : '0px'
          })`}
        >
          {stepsBeforeGroup.map((step, index) => (
            <Fragment key={`${step.id}-${index}`}>
              <FlowStep
                step={step}
                isDeletable={true}
                index={index}
                isLastStep={index === steps.length - 1}
                isNested={isNested}
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
        {/** HACKFIX (kevinkim-ogp): to ensure that the transitions are smooth */}
        <Flex
          {...editorStyles.dummyRightContainer}
          w={rightDrawerWidth}
          transform={rightDrawerTransform}
        />
        <Flex
          {...editorStyles.rightDrawerContainer}
          w={rightDrawerWidth}
          visibility={isDrawerOpen ? 'visible' : 'hidden'}
          opacity={isDrawerOpen ? 1 : 0}
          transform={rightDrawerTransform}
        >
          <EditorRightDrawer
            flowStepGroupIconUrl={flowStepGroupIconUrl}
            index={currentStepIndex}
            steps={steps}
          />
        </Flex>
      </StepExecutionsToIncludeProvider>
    </Flex>
  )
}
