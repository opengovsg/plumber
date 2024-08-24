import type { IApp } from '@plumber/types'

import { Fragment, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import { AbsoluteCenter, Box, Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { GET_APPS } from '@/graphql/queries/get-apps'
import type { TemplateStep } from '@/pages/Templates/types'

import IfThenTemplateStepContent from './IfThenTemplateStepContent'
import TemplateStepContent from './TemplateStepContent'

interface TemplateBodyProps {
  templateSteps: TemplateStep[]
}

function AddStepGraphic() {
  return (
    <Box pos="relative" h="4.5rem">
      {/* Top vertical line */}
      <Box h="1.125rem">
        <Divider orientation="vertical" borderColor="base.divider.strong" />
      </Box>
      {/* Bottom vertical line */}
      <Box mt={9} h="1.125rem">
        <Divider orientation="vertical" borderColor="base.divider.strong" />
      </Box>
      <AbsoluteCenter>
        <Flex
          borderWidth={1}
          boxSize={9}
          borderColor="base.divider.strong"
          justifyContent="center"
          alignItems="center"
          borderRadius="0.25rem"
        >
          <BiPlus />
        </Flex>
      </AbsoluteCenter>
    </Box>
  )
}

export default function TemplateBody(props: TemplateBodyProps) {
  const { templateSteps } = props

  const [templateStepsBeforeIfThen, templateStepsAfterIfThen] = useMemo(() => {
    const ifThenStartIndex = templateSteps.findIndex(
      (templateStep: TemplateStep) =>
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

  // get all apps here and pass the correct app to the template step
  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps

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
          as is. Or, add more steps to customise it to your use case.
        </Text>
      </Infobox>

      {/* Steps to display before if-then */}
      {templateStepsBeforeIfThen.map((templateStep, index) => (
        <Fragment key={index}>
          <TemplateStepContent
            app={apps?.find((app: IApp) => templateStep?.appKey === app.key)}
            eventKey={templateStep?.eventKey ?? ''}
            position={templateStep?.position ?? index + 1}
          />
          {/* Don't show if it is the last step */}
          {index < templateSteps.length - 1 && <AddStepGraphic />}
        </Fragment>
      ))}
      {/* Steps to display for if-then */}
      <IfThenTemplateStepContent
        app={apps?.find(
          (app: IApp) => templateStepsAfterIfThen[0]?.appKey === app.key,
        )}
        templateSteps={templateStepsAfterIfThen}
      />
    </Flex>
  )
}
