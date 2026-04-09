import { IStepError } from '@plumber/types'

import Markdown from 'react-markdown'
import { useMutation } from '@apollo/client'
import { Box, Text } from '@chakra-ui/react'
import { Button, Infobox, useToast } from '@opengovsg/design-system-react'

import { RETRY_PARTIAL_STEP } from '@/graphql/mutations/retry-partial-step'
import { GET_EXECUTION_STEPS } from '@/graphql/queries/get-execution-steps'

import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

import ErrorDetailsCollapse from './ErrorDetailsCollapse'
import SupportContactMessage from './SupportContactMessage'

interface SpecificErrorResultProps {
  errorDetails: IStepError
  isTestRun: boolean
  executionStepId?: string
}

export default function SpecificErrorResult(props: SpecificErrorResultProps) {
  const { errorDetails, isTestRun, executionStepId } = props
  const { name, solution, details, partialRetry } = errorDetails

  const toast = useToast()

  const [retryPartialStep, { loading }] = useMutation(RETRY_PARTIAL_STEP, {
    variables: {
      input: {
        executionStepId,
      },
    },
    onCompleted: () => {
      toast({
        title: 'Step has been retried successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    },
    refetchQueries: [GET_EXECUTION_STEPS],
  })

  return (
    <Infobox variant="error" borderRadius="lg">
      <Box minW="0" w="full">
        <Text mb={0.5} textStyle="subhead-1">
          {name}
        </Text>

        <Text textStyle="body-1">
          <Markdown linkTarget="_blank" components={infoboxMdComponents}>
            {solution}
          </Markdown>

          <SupportContactMessage />

          {details && (
            <ErrorDetailsCollapse
              details={details}
              buttonText="View http error details below."
            />
          )}

          {!isTestRun && partialRetry && executionStepId && (
            <Button
              variant="link"
              textDecoration="underline"
              mt={4}
              isLoading={loading}
              onClick={() => retryPartialStep()}
            >
              {partialRetry.buttonMessage}
            </Button>
          )}
        </Text>
      </Box>
    </Infobox>
  )
}
