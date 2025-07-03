import type { IApp, IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Center, Flex } from '@chakra-ui/react'

import EditorRightDrawer from '@/components/EditorRightDrawer'
import FlowStepGroup from '@/components/FlowStepGroup'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsToIncludeProvider } from '@/contexts/StepExecutionsToInclude'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { extractBranchesWithSteps } from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import { EDITOR_RIGHT_DRAWER_WIDTH } from './constants'
import FlowStepWithAddButton from './FlowStepWithAddButton'
import { editorStyles } from './styles'

type EditorProps = {
  isNested?: boolean
}

export default function Editor(props: EditorProps): React.ReactElement {
  const { isNested } = props

  const { allApps, isDrawerOpen, isMobile, currentStepId, flow } =
    useContext(EditorContext)

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

  const [triggerStep, stepsBeforeGroup, groupedSteps] = useMemo(() => {
    if (!groupingActions) {
      return [null, [], []]
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

    const triggerStep = steps[0]

    return groupStepIdx === -1
      ? [triggerStep, steps.slice(1), []]
      : [triggerStep, steps.slice(1, groupStepIdx), branchesWithSteps]
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

  const handleReorderSteps = async (steps: IStep[]) => {
    const stepPositions = steps.map((step, index) => ({
      id: step.id,
      position: index + 2, // trigger position is 1
      type: step.type,
    }))

    try {
      // TODO: make api call to update step positions
    } catch (error) {
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

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
          {triggerStep && (
            <FlowStepWithAddButton
              step={triggerStep}
              isLastStep={
                stepsBeforeGroup.length === 0 && groupedSteps.length === 0
              }
              isNested={isNested}
              stepsBeforeGroup={stepsBeforeGroup}
              groupedSteps={groupedSteps}
              showAddButton={true}
            />
          )}

          <SortableList
            items={stepsBeforeGroup}
            onChange={handleReorderSteps}
            renderItem={(step, _isDragging, isOverlay) => {
              const { id, position } = step
              return (
                <SortableList.Item id={id}>
                  <Flex
                    key={`${id}-${position}`}
                    width={isDrawerOpen || isMobile ? '100%' : 'auto'}
                    flexDir="column"
                    position="relative"
                  >
                    <FlowStepWithAddButton
                      step={step}
                      isLastStep={position === steps.length}
                      isNested={isNested}
                      stepsBeforeGroup={stepsBeforeGroup}
                      groupedSteps={groupedSteps}
                      showAddButton={!isOverlay}
                    />
                  </Flex>
                </SortableList.Item>
              )
            }}
          />
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
            steps={steps}
          />
        </Flex>
      </StepExecutionsToIncludeProvider>
    </Flex>
  )
}
