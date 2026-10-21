import { IJSONObject } from '@plumber/types'

import type { ReactNode } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import ErrorDetailsCollapse from './ErrorDetailsCollapse'
import SupportContactMessage from './SupportContactMessage'

interface GenericErrorResultProps {
  errorDetails: IJSONObject
  isTestRun: boolean
  children?: ReactNode
  titleAction?: ReactNode
}

export default function GenericErrorResult(props: GenericErrorResultProps) {
  const { children, errorDetails, isTestRun, titleAction } = props

  return (
    <Infobox variant="error" borderRadius="lg">
      <Box minW="0" w="full">
        <Flex
          mb={0.5}
          gap={3}
          alignItems="center"
          justifyContent="space-between"
        >
          <Text textStyle="subhead-1">We could not test this step</Text>
          {titleAction}
        </Flex>

        <Text textStyle="body-1">
          {`Check if you have configured ${
            isTestRun ? 'the steps above' : 'this step'
          } correctly and retest.`}

          <SupportContactMessage />
          <ErrorDetailsCollapse details={errorDetails} />
        </Text>
        {children}
      </Box>
    </Infobox>
  )
}
