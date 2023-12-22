import type { IApp, IExecutionStep } from '@plumber/types'

import * as React from 'react'
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
import AppIcon from 'components/AppIcon'
import ErrorResult from 'components/ErrorResult'
import JSONViewer from 'components/JSONViewer'
import { GET_APP } from 'graphql/queries/get-app'
import { EXECUTION_STEP_PER_PAGE } from 'pages/Execution'

import RetryButton from './RetryButton'

type ExecutionStepProps = {
  index: number
  page: number
  executionStep: IExecutionStep
}

const validIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
  />
)
const errorIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.critical.default"
  />
)
const getStepPosition = (page: number, index: number) => {
  return (page - 1) * EXECUTION_STEP_PER_PAGE + index + 1
}

export default function ExecutionStep({
  index,
  page,
  executionStep,
}: ExecutionStepProps): React.ReactElement | null {
  const { data } = useQuery(GET_APP, {
    variables: { key: executionStep.appKey },
  })

  const app: IApp = data?.getApp

  if (!app) {
    return null
  }

  const isStepSuccessful = executionStep.status === 'success'

  const hasError = !!executionStep.errorDetails

  const canRetry = !isStepSuccessful && !!executionStep.jobId

  return (
    <Card boxShadow="none" border="1px solid" borderColor="base.divider.medium">
      <CardBody p={0}>
        {/* top half: step number and app details */}
        <HStack p={4} alignItems="center" justifyContent="space-between">
          <HStack gap={2}>
            <Box position="relative">
              <AppIcon url={app?.iconUrl} name={app?.name} />
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
                {isStepSuccessful ? validIcon : errorIcon}
              </Box>
            </Box>

            <Box>
              <Text textStyle="body-2">
                {index === 0 && page === 1 ? 'Trigger' : 'Action'}
              </Text>

              <Text textStyle="h5">
                {getStepPosition(page, index)}. {app?.name}
              </Text>
            </Box>
          </HStack>
          {canRetry && <RetryButton executionStepId={executionStep.id} />}
        </HStack>

        {/* bottom half: data in, data out and error */}
        <Box borderTop="1px solid" borderTopColor="base.divider.strong" p={4}>
          <Tabs>
            <TabList
              borderBottom="1px solid"
              borderBottomColor="base.divider.medium"
              mb={4}
            >
              <Tab>Data In</Tab>
              <Tab>Data Out</Tab>
              {hasError && <Tab>Error</Tab>}
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
