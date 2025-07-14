import type { IExecution, IExecutionStep } from '@plumber/types'

import {
  Box,
  Card,
  CardBody,
  HStack,
  TabList,
  TabPanel,
  TabPanels,
  Text,
} from '@chakra-ui/react'
import { Tab, Tabs } from '@opengovsg/design-system-react'

import ErrorResult from '@/components/ErrorResult'
import JSONViewer from '@/components/JSONViewer'
import { EXECUTION_STEP_PER_PAGE } from '@/pages/Execution'

import AppIconWithStatus from './components/AppIconWithStatus'
import { RetryAllButton } from './components/RetryAllButton'
import RetryButton from './components/RetryButton'
import { useExecutionStepStatus } from './hooks/useExecutionStepStatus'

type ExecutionStepProps = {
  index: number
  page: number
  execution: IExecution
  executionStep: IExecutionStep
  isInForEach?: boolean
}

const getStepPosition = (page: number, index: number) => {
  return (page - 1) * EXECUTION_STEP_PER_PAGE + index + 1
}

export default function ExecutionStep({
  index,
  page,
  execution,
  executionStep,
  isInForEach,
}: ExecutionStepProps): React.ReactElement | null {
  const { appKey, jobId, errorDetails, status } = executionStep

  const { app, appName, statusIcon, hasError, isPartialSuccess, canRetry } =
    useExecutionStepStatus({
      appKey,
      status,
      errorDetails,
      execution,
      jobId,
    })

  if (!app) {
    return null
  }

  return (
    <Card boxShadow="none" border="1px solid" borderColor="base.divider.medium">
      <CardBody p={0}>
        {/* top half: step number and app details */}
        <HStack p={4} alignItems="center" justifyContent="space-between">
          <HStack gap={2}>
            <AppIconWithStatus
              iconUrl={app.iconUrl}
              appName={appName}
              statusIcon={statusIcon}
            />

            <Box>
              <Text textStyle="h5">
                {getStepPosition(page, index)}. {appName}
              </Text>
            </Box>
          </HStack>
          <HStack>
            {!isInForEach && canRetry && (
              <>
                <RetryAllButton execution={execution} />
                <RetryButton executionStepId={executionStep.id} />
              </>
            )}
          </HStack>
        </HStack>

        {/* bottom half: data in, data out and error */}
        <Box borderTop="1px solid" borderTopColor="base.divider.strong" p={4}>
          <Tabs defaultIndex={hasError ? 2 : 0}>
            <TabList
              borderBottom="1px solid"
              borderBottomColor="base.divider.medium"
              mb={4}
            >
              <Tab>Data In</Tab>
              <Tab>Data Out</Tab>
              {hasError && (
                <Tab position="relative">
                  Error
                  {isPartialSuccess && (
                    <Box
                      borderRadius="50%"
                      bg="primary.500"
                      boxSize={1.5}
                      top={1}
                      right={-2}
                      position="absolute"
                    />
                  )}
                </Tab>
              )}
            </TabList>
            <TabPanels>
              <TabPanel>
                <JSONViewer data={executionStep.dataIn} />
              </TabPanel>
              <TabPanel>
                <JSONViewer data={executionStep.dataOut} />
              </TabPanel>
              {hasError && (
                <TabPanel>
                  <ErrorResult
                    executionStepId={executionStep.id}
                    errorDetails={executionStep.errorDetails}
                    isTestRun={false}
                  />
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </Box>
      </CardBody>
    </Card>
  )
}
