import type { IExecution, IExecutionStep } from '@plumber/types'

import { useMemo, useState } from 'react'
import { Card, CardBody, Flex, Grid, HStack, Text } from '@chakra-ui/react'
import { Tag } from '@opengovsg/design-system-react'
import get from 'lodash/get'

import { ExecutionStep } from '@/exports/components'
import { type GroupedSteps } from '@/helpers/processExecutionSteps'

import AppIconWithStatus from '../ExecutionStep/components/AppIconWithStatus'
import { useExecutionStepStatus } from '../ExecutionStep/hooks/useExecutionStepStatus'

import IterationSelector from './IterationSelector'

interface ExecutionGroupProps {
  execution: IExecution
  groupingStep: IExecutionStep
  groupedSteps: GroupedSteps
  groupStats: { success: number; failure: number }
  numStepsBeforeGroup: number
  page: number
}

export default function ExecutionGroup(props: ExecutionGroupProps) {
  const {
    execution,
    groupingStep,
    groupStats,
    groupedSteps,
    page,
    numStepsBeforeGroup,
  } = props
  // NOTE: we use string here as the combobox value needs to be a string
  const [selectedIteration, setSelectedIteration] = useState('1')

  const selectedIterationStep = useMemo(() => {
    return get(groupedSteps, Number(selectedIteration) - 1)
  }, [groupedSteps, selectedIteration])

  const hasError = groupedSteps.some((iteration) =>
    iteration.steps.some((step) => step.errorDetails),
  )
  const allIterationsSuccessful = groupedSteps?.every(
    (iteration) => iteration.status === 'success',
  )

  // const canRetry = groupStats.failure > 0

  const { app, appName, statusIcon } = useExecutionStepStatus({
    appKey: groupingStep.appKey,
    stepKey: groupingStep.key,
    status: allIterationsSuccessful ? 'success' : 'failure',
    errorDetails: hasError ? {} : null,
    execution,
    jobId: groupingStep.jobId,
  })

  if (!app) {
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
                {groupStats.success > 0 && (
                  <Tag colorScheme={'success'} size="lg">
                    {groupStats.success} success
                  </Tag>
                )}
                {groupStats.failure > 0 && (
                  <Tag colorScheme={'critical'} size="lg">
                    {groupStats.failure} failures
                  </Tag>
                )}
                {/* TODO: add retry all iterations for this specific execution */}
                {/* {canRetry && (
                  <RetryAllButton execution={execution} type="iteration" />
                )} */}
              </Flex>
            </Flex>
          </HStack>
        </HStack>
        <Flex p={4} pt={0} direction="column" gap={4}>
          <IterationSelector
            groupedSteps={groupedSteps}
            selectedIteration={selectedIteration}
            setSelectedIteration={setSelectedIteration}
          />
          <Grid mb={{ base: '16px', sm: '40px' }} rowGap={6}>
            {selectedIterationStep &&
              selectedIterationStep.steps.map(
                (step: IExecutionStep, index: number) => {
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
                },
              )}
          </Grid>
        </Flex>
      </CardBody>
    </Card>
  )
}
