import type { IExecution, IExecutionStep } from '@plumber/types'

import { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Card, CardBody, Flex, Grid, HStack, Text } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import ExecutionStep from '@/components/ExecutionStep'
import AppIconWithStatus from '@/components/ExecutionStep/components/AppIconWithStatus'
import { useExecutionStepStatus } from '@/components/ExecutionStep/hooks/useExecutionStepStatus'
import { GET_EXECUTION_STEPS } from '@/graphql/queries/get-execution-steps'
import { EXECUTION_STEP_PER_PAGE, getLimitAndOffset } from '@/pages/Execution'

import GroupStatusFilter, { GroupStatusType } from './GroupStatusFilter'
import IterationSelector from './IterationSelector'

interface ExecutionGroupProps {
  execution: IExecution
  groupingStep: IExecutionStep
  groupStats: { success: number; failure: number; waiting: number }
  iterationMap: Map<number, string>
  numStepsBeforeGroup: number
}

export default function ExecutionGroup(props: ExecutionGroupProps) {
  const {
    execution,
    groupingStep,
    groupStats,
    iterationMap,
    numStepsBeforeGroup,
  } = props
  const [debouncedIteration, setDebouncedIteration] = useState('1')
  // set the page internally within the ExecutionGroup component
  // just in case there are more than 100 steps within the group
  const [page, setPage] = useState(1)
  // NOTE: we use string here as the combobox value needs to be a string
  const [selectedIteration, setSelectedIteration] = useState('1')
  const [statusFilter, setStatusFilter] = useState<GroupStatusType>(
    GroupStatusType.All,
  )

  // debounce the iteration change to reduce flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIteration(selectedIteration)
    }, 200)

    return () => clearTimeout(timer)
  }, [selectedIteration])

  const { data, loading } = useQuery(GET_EXECUTION_STEPS, {
    variables: {
      executionId: execution.id,
      ...getLimitAndOffset(page),
      iteration: Number(debouncedIteration) || null,
    },
  })
  const { pageInfo, edges } = data?.getExecutionSteps || {}
  const iterationSteps: IExecutionStep[] = edges?.map(
    (edge: { node: IExecutionStep }) => edge.node,
  )

  const hasError = iterationSteps?.some((step) => step.errorDetails)
  const allIterationsSuccessful =
    groupStats.waiting === 0 && groupStats.failure === 0

  useEffect(() => {
    if (statusFilter === GroupStatusType.All) {
      setSelectedIteration('1')
    } else {
      const firstKey = [...iterationMap.entries()].find(
        ([, value]) => value === statusFilter,
      )?.[0]
      setSelectedIteration(firstKey?.toString() || '1')
    }
  }, [iterationMap, statusFilter])

  const { app, appName, statusIcon } = useExecutionStepStatus({
    appKey: groupingStep?.appKey ?? '',
    status: !execution?.status
      ? GroupStatusType.Waiting
      : allIterationsSuccessful
      ? GroupStatusType.Success
      : GroupStatusType.Failure,
    errorDetails: hasError ? {} : null,
    execution,
    jobId: groupingStep?.jobId,
  })

  if (!execution || !groupingStep || !app) {
    return null
  }

  return (
    <Card boxShadow="none" border="1px solid" borderColor="base.divider.medium">
      <CardBody p={0}>
        <HStack p={4} alignItems="center" justifyContent="space-between">
          <HStack
            gap={2}
            w="full"
            borderBottom="1px solid"
            borderColor="base.divider.medium"
            pb={2}
          >
            <AppIconWithStatus
              iconUrl={app.iconUrl}
              appName={appName}
              statusIcon={statusIcon}
            />
            <Flex
              justifyContent="space-between"
              width="full"
              alignItems="center"
            >
              <Text textStyle="h5">
                {numStepsBeforeGroup + 1}. {appName}
              </Text>
              <Flex gap={2} alignItems="center">
                <Flex gap={2} alignItems="center">
                  <GroupStatusFilter
                    groupStats={groupStats}
                    setStatusFilter={setStatusFilter}
                    statusFilter={statusFilter}
                  />
                </Flex>
              </Flex>
            </Flex>
          </HStack>
        </HStack>
        <Flex p={4} pt={0} direction="column" gap={4}>
          {iterationMap.size > 0 ? (
            <>
              <IterationSelector
                iterationMap={iterationMap}
                selectedIteration={selectedIteration}
                setSelectedIteration={setSelectedIteration}
                iterationSteps={iterationSteps}
              />
              <Grid mb={{ base: '16px', sm: '40px' }} rowGap={6} minH="400px">
                {iterationSteps &&
                  iterationSteps.map((step: IExecutionStep, index: number) => {
                    return (
                      <ExecutionStep
                        key={step.id}
                        execution={execution}
                        executionStep={step}
                        index={index + 1 + numStepsBeforeGroup}
                        page={page}
                        isInForEach={true}
                      />
                    )
                  })}
                {!loading &&
                  pageInfo &&
                  pageInfo.totalCount > EXECUTION_STEP_PER_PAGE && (
                    <Flex justifyContent="center" mt={6}>
                      <Pagination
                        currentPage={pageInfo?.currentPage}
                        onPageChange={(page) => setPage(page)}
                        pageSize={EXECUTION_STEP_PER_PAGE}
                        totalCount={pageInfo?.totalCount}
                      />
                    </Flex>
                  )}
              </Grid>
            </>
          ) : (
            <Text>No items were available to perform actions on.</Text>
          )}
        </Flex>
      </CardBody>
    </Card>
  )
}
