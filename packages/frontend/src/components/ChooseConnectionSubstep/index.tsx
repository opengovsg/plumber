import type { IApp, IStep, ITestConnectionOutput } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiLink, BiRefresh, BiSolidCircle } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'
import useAuthentication from '@/hooks/useAuthentication'

import {
  type ConnectionDropdownOption,
  optionGenerator,
} from '../FlowStepConfigurationModal/ChooseAndAddConnection'
import {
  APP_ALLOWING_EMPTY_CONNECTION,
  EXCEL_APP_KEY,
} from '../FlowStepConfigurationModal/constants'

type ChooseConnectionSubstepProps = {
  step: IStep
  application: IApp
  onReconnect: () => void
}

type ConnectionLink = {
  url: string
  text: string
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

const excelFolderLinkGenerator = (userEmail: string) => {
  return `https://gccprod-my.sharepoint.com/shared?id=%2Fsites%2FGOVTECH%2Dplumber%2FShared%20Documents%2F${userEmail}&listurl=https%3A%2F%2Fgccprod%2Esharepoint%2Ecom%2Fsites%2FGOVTECH%2Dplumber%2FShared%20Documents`
}

function ChooseConnectionSubstep(
  props: ChooseConnectionSubstepProps,
): React.ReactElement {
  const { step, application, onReconnect } = props
  const { connection } = step
  const editorContext = useContext(EditorContext)
  const { currentUser } = useAuthentication()

  const supportsConnectionRegistration =
    !!application.auth?.connectionRegistrationType

  const { loading: testResultLoading, data: testConnectionData } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: connection?.id,
      flowId: supportsConnectionRegistration ? step.flowId : undefined,
    },
    skip: !connection?.id,
  })

  const isTestStepValid = useMemo(() => {
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
  }, [testConnectionData, testResultLoading])

  const connectionStatus: ConnectionStatus = useMemo(() => {
    if (!connection) {
      if (application.key === APP_ALLOWING_EMPTY_CONNECTION) {
        return {
          text: 'No connection',
          color: 'green.500',
        }
      } else {
        return {
          text: 'Not connected',
          color: 'yellow.200',
        }
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
          text: '(View form)',
        }
      } else if (application.key === EXCEL_APP_KEY) {
        connectionLink = {
          url: excelFolderLinkGenerator(currentUser?.email ?? ''),
          text: '(View folder)',
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
    application.key,
    testConnectionData?.testConnection?.message,
    currentUser?.email,
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
