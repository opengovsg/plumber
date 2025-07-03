import type { IApp, ITemplateStep } from '@plumber/types'

import { BiGitRepoForked } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import IfThenBranchContent from './IfThenBranchContent'

interface IfThenTemplateStepContentProps {
  templateSteps: ITemplateStep[]
  apps?: IApp[]
}

function extractBranchesWithSteps(templateSteps: ITemplateStep[]) {
  const [firstStep, ...remainingSteps] = templateSteps

  const result: Array<ITemplateStep[]> = []
  let branchWithSteps: ITemplateStep[] = [firstStep]

  for (const step of remainingSteps) {
    // check if it's an if-then step
    if (
      step.appKey === TOOLBOX_APP_KEY &&
      step.eventKey === TOOLBOX_ACTIONS.IfThen
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

export default function IfThenTemplateStepContent(
  props: IfThenTemplateStepContentProps,
) {
  const { templateSteps, apps } = props
  // sanity check
  if (!templateSteps || templateSteps.length === 0) {
    return <></>
  }
  const groupedSteps = extractBranchesWithSteps(templateSteps)

  return (
    <Flex
      w="100%"
      flexDir="column"
      border="1px solid"
      borderColor="base.divider.medium"
      borderRadius="lg"
      pb={4}
    >
      {/* This is for the if then header step */}
      <Flex w="100%" p={4} alignItems="center" columnGap={4}>
        <Icon boxSize={6} as={BiGitRepoForked} color="primary.500" ml={2} />

        <Text textStyle="subhead-1">If-then</Text>
      </Flex>

      <Flex flexDir="column" w="100%" px={4} gap={4}>
        {groupedSteps.map((branchSteps) => {
          return (
            <IfThenBranchContent
              key={branchSteps[0].position}
              branchSteps={branchSteps}
              apps={apps ?? []}
            />
          )
        })}
      </Flex>
    </Flex>
  )
}
