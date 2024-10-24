import type { IApp, IExecution, IExecutionStep } from '@plumber/types'

import { useMemo } from 'react'
import { BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import {
  Box,
  Card,
  CardBody,
  HStack,
  Icon,
  TabList,
  TabPanel,
  TabPanels,
  Text,
} from '@chakra-ui/react'
import { Tab, Tabs } from '@opengovsg/design-system-react'

import AppIcon from '@/components/AppIcon'
import ErrorResult from '@/components/ErrorResult'
import JSONViewer from '@/components/JSONViewer'
import { GET_APP } from '@/graphql/queries/get-app'
import { EXECUTION_STEP_PER_PAGE } from '@/pages/Execution'

import { RetryAllButton } from './RetryAllButton'
import RetryButton from './RetryButton'

type ExecutionStepProps = {
  index: number
  page: number
  execution: IExecution
  executionStep: IExecutionStep
}

const successIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
  />
)
const failureIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.critical.default"
  />
)

const partialIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.warning.default"
  />
)

const getStepPosition = (page: number, index: number) => {
  return (page - 1) * EXECUTION_STEP_PER_PAGE + index + 1
}

export default function ExecutionStep({
  index,
  page,
  execution,
  executionStep,
}: ExecutionStepProps): React.ReactElement | null {
  const { data } = useQuery(GET_APP, {
    variables: { key: executionStep.appKey },
  })

  const hasError = !!executionStep.errorDetails

  const isStepSuccessful = executionStep.status === 'success'
  const hasExecutionFailed = execution.status === 'failure'

  const isPartialSuccess = executionStep.status === 'success' && hasError
  const canRetry =
    !isStepSuccessful && !!executionStep.jobId && hasExecutionFailed

  const statusIcon = useMemo(() => {
    if (isPartialSuccess) {
      return partialIcon
    }
    if (isStepSuccessful) {
      return successIcon
    }
    return failureIcon
  }, [isPartialSuccess, isStepSuccessful])

  const app: IApp = data?.getApp
  if (!app) {
    return null
  }

  return (
    <Card boxShadow="none" border="1px solid" borderColor="base.divider.medium">
      <CardBody p={0}>
        {/* top half: step number and app details */}
        <HStack p={4} alignItems="center" justifyContent="space-between">
          <HStack gap={2}>
            <Box position="relative">
              <AppIcon url={app.iconUrl} name={app.name} />
              <Box
                position="absolute"
                right="0"
                top="0"
                transform="translate(50%, -50%)"
                display="inline-flex"
                sx={{
                  svg: {
                    // to make it distinguishable over an app icon
                    background: 'white',
                    borderRadius: '100%',
                    overflow: 'hidden',
                  },
                }}
              >
                {statusIcon}
              </Box>
            </Box>

            <Box>
              <Text textStyle="body-2">
                {index === 0 && page === 1 ? 'When' : 'Then'}
              </Text>

              <Text textStyle="h5">
                {getStepPosition(page, index)}. {app.name}
              </Text>
            </Box>
          </HStack>
          <HStack>
            {canRetry && <RetryAllButton execution={execution} />}
            {canRetry && <RetryButton executionStepId={executionStep.id} />}
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
