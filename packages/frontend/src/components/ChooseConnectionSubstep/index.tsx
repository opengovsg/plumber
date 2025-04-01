import type { IApp, IStep, ITestConnectionOutput } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiLink, BiRefresh, BiSolidCircle } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

import {
  type ConnectionDropdownOption,
  optionGenerator,
} from '../FlowStepConfigurationModal/ChooseAndAddConnection'
import { APP_ALLOWING_EMPTY_CONNECTION } from '../FlowStepConfigurationModal/constants'

type ChooseConnectionSubstepProps = {
  step: IStep
  application: IApp
  onReconnect: () => void
}

type ConnectionLink = {
  url: string
  text: string
  isExternal: boolean
}

interface ConnectionStatus {
  text: string
  color: string
  connectionError?: string
  connectionLink?: ConnectionLink
}

const formLinkGenerator = (connectionOption: ConnectionDropdownOption) => {
  const { label, description: formId } = connectionOption
  if (label.startsWith('[')) {
    const endIndex = label.indexOf(']')
    const env = label.substring(1, endIndex)
    // Only add subodmain for STAGING and UAT
    if (env === 'STAGING' || env === 'UAT') {
      return `https://${env}.form.gov.sg/${formId}`
    }
  }
  return `https://form.gov.sg/${formId}`
}

function ChooseConnectionSubstep(
  props: ChooseConnectionSubstepProps,
): React.ReactElement {
  const { step, application, onReconnect } = props
  const { connection } = step
  const editorContext = useContext(EditorContext)

  const supportsConnectionRegistration =
    !!application.auth?.connectionRegistrationType

  const { loading: testResultLoading, data: testConnectionData } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: connection?.id,
      flowId: supportsConnectionRegistration ? step.flowId : undefined,
    },
    // cache-first to prevent the test connection from being called multiple times
    fetchPolicy: 'cache-first',
    skip: !connection?.id,
  })

  const isTestStepValid = useMemo(() => {
    if (application.key === APP_ALLOWING_EMPTY_CONNECTION) {
      return true
    }

    if (testResultLoading || !testConnectionData?.testConnection) {
      return null
    }
    if (
      testConnectionData?.testConnection?.connectionVerified === false ||
      testConnectionData.testConnection.registrationVerified === false
    ) {
      return false
    }
    return true
  }, [application.key, testConnectionData, testResultLoading])

  const connectionStatus: ConnectionStatus = useMemo(() => {
    if (!connection) {
      return {
        text: 'Not connected',
        color: 'yellow.200',
      }
    } else if (testResultLoading) {
      return {
        text: 'Testing connection...',
        color: 'yellow.200',
      }
    } else if (!isTestStepValid) {
      return {
        text: 'Connection not verified',
        color: 'yellow.200',
        connectionError: testConnectionData?.testConnection?.message,
      }
    } else {
      const connectionOption = optionGenerator(connection, application.key)

      let connectionLink: ConnectionLink | undefined
      if (application.key === 'formsg') {
        connectionLink = {
          url: formLinkGenerator(connectionOption),
          text: 'View form',
          isExternal: true,
        }
      }

      // For FormSG, we provide a link to the form for easier reference
      return {
        text: `Connected to ${connectionOption.label}`,
        color: 'green.500',
        connectionLink,
      }
    }
  }, [
    connection,
    testResultLoading,
    isTestStepValid,
    testConnectionData?.testConnection?.message,
    application.key,
  ])

  return (
    <Flex w="100%" p="1rem 1rem 1.5rem" flexDir="column" gap={4}>
      <Flex justifyContent="space-between" alignItems="baseline">
        <Flex alignItems="baseline" gap={2}>
          <Icon
            as={BiSolidCircle}
            color={connectionStatus.color}
            boxSize={3}
            ml={1}
          />
          <Text>
            {connectionStatus.text}
            {connectionStatus.connectionLink && (
              <Link
                href={connectionStatus.connectionLink.url}
                isExternal={connectionStatus.connectionLink.isExternal}
                target="_blank"
                ml={2}
              >
                {connectionStatus.connectionLink.text}
              </Link>
            )}
            {connectionStatus.connectionError && (
              <Text color="red.500" fontSize="xs">
                {connectionStatus.connectionError}
              </Text>
            )}
          </Text>
        </Flex>

        <Button
          variant="clear"
          colorScheme="secondary"
          size="xs"
          leftIcon={connection ? <BiRefresh /> : <BiLink />}
          onClick={onReconnect}
          isDisabled={editorContext.readOnly}
        >
          {connection ? 'Reconnect' : 'Connect'}
        </Button>
      </Flex>
    </Flex>
  )
}

export default ChooseConnectionSubstep
