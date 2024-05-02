import type { IExecutionStep } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Box, Button, Flex, Grid, Text, useToast } from '@chakra-ui/react'
import { Infobox, Pagination, Spinner } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import ExecutionHeader from 'components/ExecutionHeader'
import ExecutionStep from 'components/ExecutionStep'
import { BULK_RETRY_EXECUTIONS_FLAG } from 'config/flags'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
import { BULK_RETRY_EXECUTIONS } from 'graphql/mutations/bulk-retry-executions'
import { GET_EXECUTION } from 'graphql/queries/get-execution'
import { GET_EXECUTION_STEPS } from 'graphql/queries/get-execution-steps'

type ExecutionParams = {
  executionId: string
}

export const EXECUTION_STEP_PER_PAGE = 100

const getLimitAndOffset = (page: number) => ({
  limit: EXECUTION_STEP_PER_PAGE,
  offset: (page - 1) * EXECUTION_STEP_PER_PAGE,
})

export default function Execution(): React.ReactElement {
  const { executionId } = useParams() as ExecutionParams
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const { data: execution } = useQuery(GET_EXECUTION, {
    variables: { executionId },
  })
  const { data, loading } = useQuery(GET_EXECUTION_STEPS, {
    variables: { executionId, ...getLimitAndOffset(page) },
  })

  const { pageInfo, edges } = data?.getExecutionSteps || {}
  const executionSteps: IExecutionStep[] = edges?.map(
    (edge: { node: IExecutionStep }) => edge.node,
  )

  // FIXME (ogp-weeloong: move this elsewhere and spruce up looks.)
  const flowId = execution?.getExecution?.flow?.id
  const { flags } = useContext(LaunchDarklyContext)
  const toast = useToast()
  const [isBulkRetrying, setIsBulkRetrying] = useState(false)
  const [bulkRetryExecutions] = useMutation(BULK_RETRY_EXECUTIONS)
  const onBulkRetryExecutions = useCallback(async () => {
    setIsBulkRetrying(true)
    try {
      const result = await bulkRetryExecutions({
        variables: {
          input: {
            flowId: flowId ?? '',
          },
        },
      })
      let message =
        'Plumber has started retrying all failures for this pipe. Please check the executions page after a while to see updated status.'
      if (result.data?.bulkRetryExecutions?.numFailedExecutions === 0) {
        message = 'Plumber did not find any failed executions to retry.'
      } else if (!result.data?.bulkRetryExecutions?.allSuccessfullyRetried) {
        message =
          'Plumber was unable to retry some failed executions. Please manually retry the failed step.'
      }

      toast({
        title: message,
        status: 'info',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    } finally {
      setIsBulkRetrying(false)
    }
  }, [flowId, bulkRetryExecutions, toast])

  return (
    <Container sx={{ py: 3 }}>
      <ExecutionHeader execution={execution?.getExecution} />

      {flags?.[BULK_RETRY_EXECUTIONS_FLAG] && (
        <Button
          variant="outline"
          isDisabled={loading}
          isLoading={isBulkRetrying}
          spinner={<Spinner fontSize={24} />}
          size="md"
          onClick={onBulkRetryExecutions}
        >
          Retry all failed executions for this pipe (BETA)
        </Button>
      )}

      <Grid mt={4} mb={{ base: '16px', sm: '40px' }} rowGap={6}>
        {!loading && !executionSteps?.length && (
          <>
            <Infobox variant="warning">
              <Box>
                <Text textStyle="subhead-1" mb={1}>
                  No data
                </Text>
                <Text textStyle="body-1">
                  We successfully ran the execution, but there was no new data
                  to process.
                </Text>
              </Box>
            </Infobox>
          </>
        )}

        {executionSteps?.map((executionStep, i) => (
          <ExecutionStep
            key={executionStep.id}
            executionStep={executionStep}
            index={i}
            page={page}
          />
        ))}
      </Grid>

      {!loading &&
        pageInfo &&
        pageInfo.totalCount > EXECUTION_STEP_PER_PAGE && (
          <Flex justifyContent="center" mt={6}>
            <Pagination
              currentPage={pageInfo?.currentPage}
              onPageChange={(page) =>
                setSearchParams(page === 1 ? {} : { page: page.toString() })
              }
              pageSize={EXECUTION_STEP_PER_PAGE}
              totalCount={pageInfo?.totalCount}
            />
          </Flex>
        )}
    </Container>
  )
}
