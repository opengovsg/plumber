import type { IApp } from '@plumber/types'

import { useContext, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import {
  Flex,
  Link,
  ListItem,
  ModalBody,
  ModalHeader,
  OrderedList,
  Spinner,
  Text,
} from '@chakra-ui/react'
import {
  Button,
  Infobox,
  ModalCloseButton,
} from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

import BackButton from '../BackButton'
import { DATABRICKS_APP_KEY } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import { useConnectionVerification } from '../hooks/useConnectionRegistration'

import ConnectionHeader from './ConnectionHeader'

function NotOnboardedContent({
  onRecheck,
  isLoading,
}: {
  onRecheck: () => Promise<void>
  isLoading: boolean
}) {
  return (
    <Flex flexDir="column" gap={4}>
      <Infobox variant="warning">
        The Govtech Data Platform requires onboarding before use. It looks like
        you&apos;re not onboarded yet.
      </Infobox>

      <Text>How to get access:</Text>
      <OrderedList ml={8} spacing={2}>
        <ListItem>
          Join <b>#ask-cdo</b> channel on GovTech Slack
        </ListItem>
        <ListItem>
          Click on <b>Onboarding Request</b> button and follow the instructions.
        </ListItem>
        <ListItem>
          Come back and click <b>Check access</b> below
        </ListItem>
      </OrderedList>

      <Text fontSize="md" mb={2}>
        For more information, please refer to{' '}
        <Link
          display="inline"
          href="https://go.gov.sg/gdp-onboarding"
          isExternal
        >
          this guide
        </Link>
        .
      </Text>

      <Button isFullWidth size="lg" onClick={onRecheck} isLoading={isLoading}>
        Check access
      </Button>
    </Flex>
  )
}

function OnboardedContent({
  handleSubmit,
}: {
  handleSubmit: () => Promise<void>
}) {
  return (
    <Flex flexDir="column" gap={3}>
      <Infobox variant="success">
        Your access to the Govtech Data Platform has been verified!
      </Infobox>
      <Button isFullWidth onClick={handleSubmit} mt={4}>
        Continue
      </Button>
    </Flex>
  )
}

interface ConfigureDatabricksConnectionProps {
  onBack: () => void
  onCreateOrUpdateStep: (connectionId: string) => Promise<void>
}

export default function ConfigureDatabricksConnection(
  props: ConfigureDatabricksConnectionProps,
) {
  const { onBack, onCreateOrUpdateStep } = props
  const { flowId } = useContext(EditorContext)
  const { modalState, step } = useContext(FlowStepConfigurationContext)
  const { selectedApp, selectedConnectionId } = modalState
  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel

  // Fallback query in case the modal is reached without selectedConnectionId set
  // (ChooseAppAndEvent normally populates it, but not all entry points do).
  const { data: appConnectionsData, loading: connectionsLoading } = useQuery(
    GET_APP_CONNECTIONS,
    {
      variables: { key: DATABRICKS_APP_KEY, flowId },
    },
  )

  const connectionId =
    selectedConnectionId ??
    appConnectionsData?.getApp?.connections?.[0]?.id ??
    ''

  const { testResult, testResultLoading, testConnection } =
    useConnectionVerification({
      supportsConnectionRegistration: false,
    })

  useEffect(() => {
    if (connectionId) {
      testConnection(connectionId)
    }
  }, [connectionId, testConnection])

  const isLoading = connectionsLoading || testResultLoading
  const isConnectionVerified =
    !isLoading && testResult?.connectionVerified === true

  const renderBody = () => {
    if (isLoading) {
      return (
        <Flex alignItems="center" flexDir="column" py={8}>
          <Spinner size="xl" color="primary.500" thickness="4px" />
          <Text textStyle="header-1" mt={8}>
            Checking for access...
          </Text>
        </Flex>
      )
    }
    if (isConnectionVerified) {
      return (
        <OnboardedContent
          handleSubmit={async () => await onCreateOrUpdateStep(connectionId)}
        />
      )
    }
    return (
      <NotOnboardedContent
        onRecheck={async () => {
          if (connectionId) {
            await testConnection(connectionId)
          }
        }}
        isLoading={testResultLoading}
      />
    )
  }

  return (
    <>
      <ModalHeader pt={0} mt={-4}>
        {!isConnectionVerified && (!step?.key || !step?.appKey) && (
          <BackButton onBack={onBack} />
        )}
        <ConnectionHeader
          selectedApp={selectedApp as IApp}
          headerText={
            connectionModalLabel?.chooseConnectionLabel ??
            'Connect to Databricks'
          }
        />
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" colorScheme="secondary" />

      <ModalBody>{renderBody()}</ModalBody>
    </>
  )
}
