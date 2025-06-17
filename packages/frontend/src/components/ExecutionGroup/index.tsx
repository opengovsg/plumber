import type { IExecution, IExecutionStep } from '@plumber/types'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardBody, Flex, Grid, HStack, Text } from '@chakra-ui/react'

import { ExecutionStep } from '@/exports/components'
import { type GroupedSteps } from '@/helpers/processExecutionSteps'

import AppIconWithStatus from '../ExecutionStep/components/AppIconWithStatus'
import { useExecutionStepStatus } from '../ExecutionStep/hooks/useExecutionStepStatus'

import GroupStatusFilter, { GroupStatusType } from './GroupStatusFilter'
import IterationSelector from './IterationSelector'

interface ExecutionGroupProps {
  execution: IExecution
  groupingStep: IExecutionStep
  groupedSteps: GroupedSteps
  groupStats: { success: number; failure: number; waiting: number }
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
  const [statusFilter, setStatusFilter] = useState<GroupStatusType>(
    GroupStatusType.All,
  )

  const hasError = groupedSteps.some((iteration) =>
    iteration.steps.some((step) => step.errorDetails),
  )
  const allIterationsSuccessful = groupedSteps?.every(
    (step) => step.status === GroupStatusType.Success,
  )

  const iterationsToShow = useMemo(() => {
    if (!groupedSteps?.length) {
      return []
    }

    let filteredSteps: GroupedSteps = groupedSteps
    if (statusFilter !== GroupStatusType.All) {
      filteredSteps = groupedSteps.filter(
        (iteration) => iteration.status === statusFilter,
      )
    }
    return filteredSteps
  }, [groupedSteps, statusFilter])

  useEffect(() => {
    if (iterationsToShow.length > 0) {
      // Check if current selection is still valid
      const currentIterationExists = iterationsToShow.some(
        (iteration) => iteration.iteration.toString() === selectedIteration,
      )

      if (!currentIterationExists) {
        setSelectedIteration(iterationsToShow[0].iteration.toString())
      }
    }
  }, [iterationsToShow, selectedIteration])

  const selectedIterationStep = useMemo(() => {
    return (
      groupedSteps?.find(
        (iteration) => iteration.iteration.toString() === selectedIteration,
      ) ?? null
    )
  }, [groupedSteps, selectedIteration])

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

  if (!execution || !groupingStep || !groupedSteps || !app) {
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
          <IterationSelector
            groupedSteps={iterationsToShow}
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
