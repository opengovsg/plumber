import { IStepError } from '@plumber/types'

import { useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import { useMutation } from '@apollo/client'
import { Box, Collapse, Text } from '@chakra-ui/react'
import {
  Badge,
  Button,
  Infobox,
  useToast,
} from '@opengovsg/design-system-react'
import JSONViewer from 'components/JSONViewer'
import { RETRY_PARTIAL_STEP } from 'graphql/mutations/retry-partial-step'
import { GET_EXECUTION_STEPS } from 'graphql/queries/get-execution-steps'

interface SpecificErrorResultProps {
  errorDetails: IStepError
  isTestRun: boolean
  executionStepId?: string
}

const contactPlumberMessage =
  'If this error still persists, contact us at support@plumber.gov.sg.'

export default function SpecificErrorResult(props: SpecificErrorResultProps) {
  const { errorDetails, isTestRun, executionStepId } = props
  const { name, solution, position, appName, details, partialRetry } =
    errorDetails
  const [isOpen, setIsOpen] = useState(false)
  const toggleDropdown = useCallback(() => {
    setIsOpen((value) => !value)
  }, [])

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
    <Infobox variant="error">
      <Box minW="0">
        {/* Actual executions will not need to show step position and app name */}
        {isTestRun && (
          <Badge
            mb={2}
            bg="interaction.critical-subtle.default"
            color="interaction.critical.default"
          >
            <Text>{`Step ${position}: ${appName} error`}</Text>
          </Badge>
        )}

        <Text mb={0.5} textStyle="subhead-1">
          {name}
        </Text>

        <Text textStyle="body-1">
          <Markdown linkTarget="_blank">
            {solution + '\n' + contactPlumberMessage}
          </Markdown>
          {details && (
            <>
              <Button
                onClick={toggleDropdown}
                variant="link"
                size="sm"
                sx={{ textDecoration: 'underline' }}
                mt={2}
              >
                View http error details below.
              </Button>

              <Box>
                <Collapse in={isOpen}>
                  <JSONViewer data={details}></JSONViewer>
                </Collapse>
              </Box>
            </>
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
