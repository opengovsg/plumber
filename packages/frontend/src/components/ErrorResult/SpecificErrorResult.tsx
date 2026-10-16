import { IStepError } from '@plumber/types'

import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import { useMutation } from '@apollo/client'
import { Box, Flex, Text } from '@chakra-ui/react'
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
  children?: ReactNode
  titleAction?: ReactNode
}

export default function SpecificErrorResult(props: SpecificErrorResultProps) {
  const { children, errorDetails, isTestRun, executionStepId, titleAction } =
    props
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
        <Flex
          mb={0.5}
          gap={3}
          alignItems="center"
          justifyContent="space-between"
        >
          <Text textStyle="subhead-1">{name}</Text>
          {titleAction}
        </Flex>

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
        {children}
      </Box>
    </Infobox>
  )
}
