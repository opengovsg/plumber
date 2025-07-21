import type { IApp, ITemplateStep } from '@plumber/types'

import { Fragment, useMemo } from 'react'
import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import GroupTemplateStepContent from './GroupTemplateStepContent'
import TemplateStepContent from './TemplateStepContent'

interface TemplateBodyProps {
  templateSteps: ITemplateStep[]
  apps: IApp[]
}

export function BetweenStepsGraphic() {
  return (
    <Box h={12}>
      <Divider orientation="vertical" borderColor="base.divider.strong" />
    </Box>
  )
}

export default function TemplateBody(props: TemplateBodyProps) {
  const { templateSteps, apps } = props

  const [templateStepsBeforeGroup, templateStepsAfterGroup, groupType] =
    useMemo(() => {
      const groupStartIndex = templateSteps.findIndex(
        (templateStep: ITemplateStep) =>
          templateStep?.appKey === TOOLBOX_APP_KEY &&
          (templateStep?.eventKey === TOOLBOX_ACTIONS.IfThen ||
            templateStep?.eventKey === TOOLBOX_ACTIONS.ForEach),
      )
      if (groupStartIndex === -1) {
        return [templateSteps, [], undefined]
      }
      return [
        templateSteps.slice(0, groupStartIndex),
        templateSteps.slice(groupStartIndex),
        templateSteps[groupStartIndex]?.eventKey,
      ]
    }, [templateSteps])

  return (
    <Flex
      flexDir="column"
      justifyContent="center"
      alignItems="center"
      w={{ base: '100%', md: '90%', lg: '60%' }}
      mx="auto"
      py={{ base: '0.75rem', md: '1.5rem' }}
    >
      <Infobox icon={<></>} variant="primary" mb={6}>
        <Text textStyle="body-1">
          This is a preview of your workflow. Add details to use this template
          as-is. Or, add more steps to customise it to your use case.
        </Text>
      </Infobox>

      {/* Steps to display before if-then */}
      {templateStepsBeforeGroup.map((templateStep, index) => (
        <Fragment key={index}>
          <TemplateStepContent
            app={apps?.find((app: IApp) => templateStep?.appKey === app.key)}
            templateStep={templateStep}
          />
          {/* Don't show if it is the last step */}
          {index < templateSteps.length - 1 && <BetweenStepsGraphic />}
        </Fragment>
      ))}
      {/* Steps to display for if-then */}
      <GroupTemplateStepContent
        templateSteps={templateStepsAfterGroup}
        apps={apps}
        groupType={groupType}
      />
    </Flex>
  )
}
