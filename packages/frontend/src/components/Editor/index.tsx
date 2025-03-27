import type { IApp, IFlow, IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
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

import FlowStep from '@/components/FlowStep'
import FlowStepGroup from '@/components/FlowStepGroup'
import { EditorContext } from '@/contexts/Editor'
import {
  StepExecutionsToIncludeContext,
  StepExecutionsToIncludeProvider,
} from '@/contexts/StepExecutionsToInclude'
import { GET_APPS } from '@/graphql/queries/get-apps'

import FlowStepConfigurationModal from '../FlowStepConfigurationModal'

interface AddStepButtonProps {
  isHidden: boolean
  isLastStep: boolean
  stepId: string
}

function AddStepButton(props: AddStepButtonProps): JSX.Element {
  const { isHidden, isLastStep, stepId } = props
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

      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false} // Can only add an action all the time
          isLastStep={isLastStep}
          prevStepId={stepId}
        />
      )}
    </>
  )
}

type EditorProps = {
  flow: IFlow
  steps: IStep[]
}

export default function Editor(props: EditorProps): React.ReactElement {
  const { flow, steps: rawSteps } = props

  const {
    readOnly: isReadOnlyEditor,
    currentStepId,
    onUpdateStep,
    setCurrentStepId,
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
        pb={24}
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
                isHidden={isReadOnlyEditor || isTriggerOrActionAbsent}
                isLastStep={index === steps.length - 1}
                stepId={step.id}
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
            />
          )}
        </StepExecutionsToIncludeProvider>
      </Flex>
    </Flex>
  )
}
