import type { IApp, ITemplateStep } from '@plumber/types'

import { Fragment } from 'react'
import { Flex, Text } from '@chakra-ui/react'

import { BetweenStepsGraphic } from './TemplateBody'
import TemplateStepContent from './TemplateStepContent'

interface GroupContentProps {
  groupSteps: ITemplateStep[]
  apps: IApp[]
}

export default function GroupContent(props: GroupContentProps) {
  const { groupSteps, apps } = props
  return (
    <Flex
      key={groupSteps[0].position}
      flexDir="column"
      w="100%"
      p={4}
      borderRadius="lg"
      bg="#f8f9f9"
      gap={4}
    >
      {/* Branch name */}
      <Text textStyle="subhead-1" color="base.content.default" noOfLines={1}>
        {groupSteps[0].parameters?.branchName as string}
      </Text>

      <Flex flexDir="column" w="100%" px={4} alignItems="center">
        {groupSteps.map((templateStep, index) => {
          return (
            <Fragment key={index}>
              <TemplateStepContent
                app={apps.find((app: IApp) => templateStep.appKey === app.key)}
                templateStep={templateStep}
                isNested={true}
              />
              {/* Don't show if it is the last step */}
              {index < groupSteps.length - 1 && <BetweenStepsGraphic />}
            </Fragment>
          )
        })}
      </Flex>
    </Flex>
  )
}
