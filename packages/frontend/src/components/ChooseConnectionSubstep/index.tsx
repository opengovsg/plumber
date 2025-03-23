import type { IApp, IStep, ITestConnectionOutput } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiRefresh, BiSolidCircle } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import { Flex, Icon } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import { EditorContext } from '@/contexts/Editor'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

import {
  type ConnectionDropdownOption,
  optionGenerator,
} from '../FlowStepConfigurationModal/ChooseAndAddConnection'
import { APP_ALLOWING_EMPTY_CONNECTION } from '../FlowStepConfigurationModal/constants'
import { infoboxMdComponents } from '../MarkdownRenderer/CustomMarkdownComponents'

type ChooseConnectionSubstepProps = {
  step: IStep
  application: IApp
  onReconnect: () => void
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
      stepId: supportsConnectionRegistration ? step.id : undefined,
    },
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
  }, [application.key, testConnectionData?.testConnection, testResultLoading])

  const connectionText = useMemo(() => {
    if (!connection) {
      return 'No connection selected'
    } else if (testResultLoading) {
      return 'Testing connection...'
    } else if (!isTestStepValid) {
      return 'Connection error'
    } else {
      const connectionOption = optionGenerator(connection, application.key)

      // For FormSG, we provide a link to the form for easier reference
      return `Connected to ${connectionOption.label} ${
        application.key === 'formsg'
          ? `([View form](${formLinkGenerator(connectionOption)}))`
          : ''
      }`
    }
  }, [connection, testResultLoading, isTestStepValid, application.key])

  return (
    <>
      <Flex w="100%" p="1rem 1rem 1.5rem" flexDir="column" gap={4}>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={2}>
            <Icon
              as={BiSolidCircle}
              color={isTestStepValid ? 'green.500' : 'yellow.200'}
              boxSize={3}
            />
            <MarkdownRenderer
              source={connectionText}
              components={infoboxMdComponents}
            />
          </Flex>

          <Button
            variant="clear"
            colorScheme="secondary"
            leftIcon={<BiRefresh />}
            onClick={onReconnect}
            isDisabled={editorContext.readOnly}
          >
            Reconnect
          </Button>
        </Flex>
      </Flex>
    </>
  )
}

export default ChooseConnectionSubstep
