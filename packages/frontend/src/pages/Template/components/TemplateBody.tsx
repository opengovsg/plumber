import type { IApp, ITemplateStep } from '@plumber/types'

import { Fragment, useMemo } from 'react'
import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import IfThenTemplateStepContent from './IfThenTemplateStepContent'
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

  const [templateStepsBeforeIfThen, templateStepsAfterIfThen] = useMemo(() => {
    const ifThenStartIndex = templateSteps.findIndex(
      (templateStep: ITemplateStep) =>
        templateStep?.appKey === 'toolbox' &&
        templateStep?.eventKey === 'ifThen',
    )
    if (ifThenStartIndex === -1) {
      return [templateSteps, []]
    }
    return [
      templateSteps.slice(0, ifThenStartIndex),
      templateSteps.slice(ifThenStartIndex),
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
      {templateStepsBeforeIfThen.map((templateStep, index) => (
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
      <IfThenTemplateStepContent
        templateSteps={templateStepsAfterIfThen}
        apps={apps}
      />
    </Flex>
  )
}
