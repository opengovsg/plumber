import type { IApp, IExecutionStep } from '@plumber/types'

import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { useQuery } from '@apollo/client'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import AppIcon from 'components/AppIcon'
import JSONViewer from 'components/JSONViewer'
import TabPanel from 'components/TabPanel'
import { GET_APP } from 'graphql/queries/get-app'

import RetryButton from './RetryButton'
import {
  AppIconStatusIconWrapper,
  AppIconWrapper,
  Content,
  Header,
  Wrapper,
} from './style'

type ExecutionStepProps = {
  index: number
  executionStep: IExecutionStep
}

const validIcon = <CheckCircleIcon color="success" />
const errorIcon = <ErrorIcon color="error" />

export default function ExecutionStep({
  index,
  executionStep,
}: ExecutionStepProps): React.ReactElement | null {
  const [activeTabIndex, setActiveTabIndex] = React.useState(0)

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
    <Wrapper elevation={1} data-test="execution-step">
      <Header>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" gap={2}>
            <AppIconWrapper>
              <AppIcon url={app?.iconUrl} name={app?.name} />

              <AppIconStatusIconWrapper>
                {isStepSuccessful ? validIcon : errorIcon}
              </AppIconStatusIconWrapper>
            </AppIconWrapper>

            <div>
              <Typography variant="caption">
                <FormattedMessage
                  id={
                    index === 0 ? 'flowStep.triggerType' : 'flowStep.actionType'
                  }
                />
              </Typography>

              <Typography variant="body2">
                {index + 1}. {app?.name}
              </Typography>
            </div>
          </Stack>
          <RetryButton canRetry={canRetry} executionStepId={executionStep.id} />
        </Stack>
      </Header>

      <Content sx={{ px: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTabIndex}
            onChange={(event, tabIndex) => setActiveTabIndex(tabIndex)}
          >
            <Tab label="Data in" data-test="data-in-tab" />
            <Tab label="Data out" data-test="data-out-tab" />
            {hasError && <Tab label="Error" data-test="error-tab" />}
          </Tabs>
        </Box>

        <TabPanel value={activeTabIndex} index={0}>
          <JSONViewer data={executionStep.dataIn} />
        </TabPanel>

        <TabPanel value={activeTabIndex} index={1}>
          <JSONViewer data={executionStep.dataOut} />
        </TabPanel>

        {hasError && (
          <TabPanel value={activeTabIndex} index={2}>
            <JSONViewer data={executionStep.errorDetails} />
          </TabPanel>
        )}
      </Content>
    </Wrapper>
  )
}
