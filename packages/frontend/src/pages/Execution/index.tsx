import type { IExecutionStep } from '@plumber/types'

import * as React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Flex } from '@chakra-ui/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { Pagination } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import ExecutionHeader from 'components/ExecutionHeader'
import ExecutionStep from 'components/ExecutionStep'
import { GET_EXECUTION } from 'graphql/queries/get-execution'
import { GET_EXECUTION_STEPS } from 'graphql/queries/get-execution-steps'
import useFormatMessage from 'hooks/useFormatMessage'

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
  const formatMessage = useFormatMessage()
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

  return (
    <Container sx={{ py: 3 }}>
      <ExecutionHeader execution={execution?.getExecution} />

      <Grid container item sx={{ mt: 2, mb: [2, 5] }} rowGap={3}>
        {!loading && !executionSteps?.length && (
          <Alert severity="warning" sx={{ flex: 1 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>
              {formatMessage('execution.noDataTitle')}
            </AlertTitle>

            <Box sx={{ fontWeight: 400 }}>
              {formatMessage('execution.noDataMessage')}
            </Box>
          </Alert>
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
            ></Pagination>
          </Flex>
        )}
    </Container>
  )
}
