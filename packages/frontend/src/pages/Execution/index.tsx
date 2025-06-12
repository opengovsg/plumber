import type { IExecutionStep } from '@plumber/types'

import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Box, Flex, Grid, Text } from '@chakra-ui/react'
import { Infobox, Pagination, Spinner } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import ExecutionGroup from '@/components/ExecutionGroup'
import ExecutionHeader from '@/components/ExecutionHeader'
import ExecutionStep from '@/components/ExecutionStep'
import { GET_EXECUTION } from '@/graphql/queries/get-execution'
import { GET_EXECUTION_STEPS } from '@/graphql/queries/get-execution-steps'
import processExecutionSteps from '@/helpers/processExecutionSteps'

type ExecutionParams = {
  executionId: string
}

export const EXECUTION_STEP_PER_PAGE = 100

const getLimitAndOffset = (page: number) => ({
  limit: EXECUTION_STEP_PER_PAGE,
  offset: (page - 1) * EXECUTION_STEP_PER_PAGE,
})

export default function Execution() {
  const { executionId } = useParams() as ExecutionParams
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const { data: executionData } = useQuery(GET_EXECUTION, {
    variables: { executionId },
  })
  const { data, loading } = useQuery(GET_EXECUTION_STEPS, {
    variables: { executionId, ...getLimitAndOffset(page) },
  })

  const { pageInfo, edges } = data?.getExecutionSteps || {}
  const executionSteps: IExecutionStep[] = edges?.map(
    (edge: { node: IExecutionStep }) => edge.node,
  )

  const execution = executionData?.getExecution
  const {
    groupingStep,
    groupStats,
    groupedSteps,
    hasGrouping,
    stepsBeforeGroup,
  } = useMemo(() => processExecutionSteps(executionSteps), [executionSteps])

  if (!execution) {
    return <Spinner fontSize={36} margin="auto" />
  }

  return (
    <Container sx={{ py: 3 }}>
      <ExecutionHeader execution={execution} />

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

        {hasGrouping ? (
          <>
            {stepsBeforeGroup?.map((executionStep, i) => (
              <ExecutionStep
                key={executionStep.id}
                execution={execution}
                executionStep={executionStep}
                index={i}
                page={page}
              />
            ))}
            <ExecutionGroup
              execution={execution}
              groupingStep={groupingStep}
              numStepsBeforeGroup={stepsBeforeGroup.length}
              groupedSteps={groupedSteps}
              page={page}
              groupStats={groupStats}
            />
          </>
        ) : (
          executionSteps?.map((executionStep, i) => (
            <ExecutionStep
              key={executionStep.id}
              execution={execution}
              executionStep={executionStep}
              index={i}
              page={page}
            />
          ))
        )}
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
