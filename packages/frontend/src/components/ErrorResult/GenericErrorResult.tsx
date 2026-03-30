import { IJSONObject } from '@plumber/types'

import { Box, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import ErrorDetailsCollapse from './ErrorDetailsCollapse'
import SupportContactMessage from './SupportContactMessage'

interface GenericErrorResultProps {
  errorDetails: IJSONObject
  isTestRun: boolean
}

export default function GenericErrorResult(props: GenericErrorResultProps) {
  const { errorDetails, isTestRun } = props

  return (
    <Infobox variant="error" borderRadius="lg">
      <Box minW="0" w="full">
        <Text mb={0.5} textStyle="subhead-1">
          We could not test this step
        </Text>

        <Text textStyle="body-1">
          {`Check if you have configured ${
            isTestRun ? 'the steps above' : 'this step'
          } correctly and retest.`}

          <SupportContactMessage />
          <ErrorDetailsCollapse details={errorDetails} />
        </Text>
      </Box>
    </Infobox>
  )
}
