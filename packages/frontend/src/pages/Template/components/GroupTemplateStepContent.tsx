import type { IApp, ITemplateStep } from '@plumber/types'

import { Flex, Icon, Text } from '@chakra-ui/react'

import { TOOLBOX_ACTION_TO_ICON_MAP } from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/ToolboxEvent'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import GroupContent from './GroupContent'

interface GroupTemplateStepContentProps {
  templateSteps: ITemplateStep[]
  apps: IApp[]
  groupType?: string
}

function extractBranchesWithSteps(templateSteps: ITemplateStep[]) {
  const [firstStep, ...remainingSteps] = templateSteps

  const result: Array<ITemplateStep[]> = []
  let branchWithSteps: ITemplateStep[] = [firstStep]

  for (const step of remainingSteps) {
    // check if it's an if-then step
    if (
      step.appKey === TOOLBOX_APP_KEY &&
      (step.eventKey === TOOLBOX_ACTIONS.IfThen ||
        step.eventKey === TOOLBOX_ACTIONS.ForEach)
    ) {
      result.push(branchWithSteps)
      branchWithSteps = [step]
    } else {
      branchWithSteps.push(step)
    }
  }

  result.push(branchWithSteps)
  return result
}

export default function GroupTemplateStepContent(
  props: GroupTemplateStepContentProps,
) {
  const { templateSteps, apps, groupType } = props
  // sanity check
  if (!templateSteps || templateSteps.length === 0) {
    return <></>
  }
  const groupedSteps = extractBranchesWithSteps(templateSteps)
  const header = groupType === TOOLBOX_ACTIONS.IfThen ? 'If-then' : 'For each'
  const headerIcon =
    TOOLBOX_ACTION_TO_ICON_MAP[
      groupType as keyof typeof TOOLBOX_ACTION_TO_ICON_MAP
    ]

  return (
    <Flex
      w="100%"
      flexDir="column"
      border="1px solid"
      borderColor="base.divider.medium"
      borderRadius="lg"
      pb={4}
    >
      {/* This is for the group header step */}
      <Flex w="100%" p={4} alignItems="center" columnGap={4}>
        <Icon boxSize={6} as={headerIcon} color="primary.500" ml={2} />

        <Text textStyle="subhead-1">{header}</Text>
      </Flex>

      <Flex flexDir="column" w="100%" px={4} gap={4}>
        {groupedSteps.map((steps) => {
          return (
            <GroupContent
              key={steps[0].position}
              groupSteps={steps}
              apps={apps}
            />
          )
        })}
      </Flex>
    </Flex>
  )
}
