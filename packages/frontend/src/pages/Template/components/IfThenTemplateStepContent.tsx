import type { IApp } from '@plumber/types'

import { BiQuestionMark } from 'react-icons/bi'
import { Box, Card, Flex, Icon, Image, Text } from '@chakra-ui/react'

import type { TemplateStep } from '@/graphql/__generated__/graphql'

interface IfThenTemplateStepContentProps {
  app?: IApp
  templateSteps: TemplateStep[]
}

export default function IfThenTemplateStepContent(
  props: IfThenTemplateStepContentProps,
) {
  const { app, templateSteps } = props
  // sanity check
  if (!templateSteps || templateSteps.length === 0) {
    return <></>
  }
  const branchNames: string[] = []
  templateSteps.forEach((templateStep) => {
    if (templateStep.parameters && templateStep.parameters['branchName']) {
      branchNames.push(String(templateStep.parameters['branchName']))
    }
  })
  return (
    <Flex w="100%" flexDir="column">
      {/* This is for the if then header step */}
      <Card
        variant="outline"
        w="100%"
        p={4}
        display="flex"
        flexDir="row"
        alignItems="center"
        columnGap={4}
        borderTopRadius="lg"
        borderBottomRadius="none"
      >
        <Flex
          borderWidth={1}
          boxSize={16}
          borderColor="base.divider.strong"
          justifyContent="center"
          alignItems="center"
          borderRadius="base"
        >
          <Image
            src={app?.iconUrl}
            boxSize={6}
            borderStyle="solid"
            fit="contain"
            fallback={
              <Icon
                boxSize={6}
                as={BiQuestionMark}
                color="base.content.default"
              />
            }
          />
        </Flex>

        <Flex flexDir="column" rowGap={1.5}>
          <Text textStyle="body-2">Then</Text>
          <Text textStyle="subhead-1">If-then</Text>
        </Flex>
      </Card>

      {/* This is for the branches */}
      {branchNames.map((branchName, index) => (
        <Box
          key={index}
          p="1.25rem 1rem"
          borderWidth={1}
          borderColor="base.divider.medium"
          borderTop="none"
          borderBottomRadius={
            index === branchNames.length - 1 ? 'lg' : undefined
          }
        >
          <Text textStyle="subhead-1">{branchName}</Text>
        </Box>
      ))}
    </Flex>
  )
}
