import type { IField, IJSONObject } from '@plumber/types'

import { useCallback, useContext, useEffect, useState } from 'react'
import { FieldValues, SubmitHandler } from 'react-hook-form'
import { BiChevronLeft } from 'react-icons/bi'
import { Flex, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import {
  Button,
  Infobox,
  ModalCloseButton,
} from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { processStep } from '@/helpers/authenticationSteps'
import computeAuthStepVariables from '@/helpers/computeAuthStepVariables'
import { getOpenerOrigin } from '@/helpers/window'

import Form from '../../Form'
import { infoboxMdComponents } from '../../MarkdownRenderer/CustomMarkdownComponents'
import { DEFAULT_ADD_CONNECTION_LABEL } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import { useConnectionVerification } from '../hooks/useConnectionRegistration'
import InvalidModalScreen from '../InvalidModalScreen'

import ConnectionHeader from './ConnectionHeader'

type AddConnectionProps = {
  handleConnectionChange: (
    connectionId: string,
    shouldRefetch: boolean,
  ) => Promise<void>
  onCreateOrUpdateStep: (connectionId: string) => Promise<void>
}

type Response = {
  [key: string]: any
}

export default function AddConnection(props: AddConnectionProps): JSX.Element {
  const { handleConnectionChange, onCreateOrUpdateStep } = props
  const { modalState, patchModalState } = useContext(
    FlowStepConfigurationContext,
  )
  const { selectedApp } = modalState
  const { name, authDocUrl, key, auth } = selectedApp || {}

  const [error, setError] = useState<IJSONObject | null>(null)
  const [inProgress, setInProgress] = useState(false)
  const steps = auth?.authenticationSteps
  const connectionModalLabel = auth?.connectionModalLabel

  useEffect(() => {
    if (
      // checks if this window/popup is opened by the same origin
      getOpenerOrigin() === window.location.origin
    ) {
      window.opener.postMessage(
        {
          source: 'plumber',
          payload: window.location.search,
        },
        // ensures that the message is only sent to the origin that opened the popup
        window.location.origin,
      )
    }
  }, [])

  const supportsConnectionRegistration =
    !!selectedApp?.auth?.connectionRegistrationType

  const { onRegisterConnection, testConnection } = useConnectionVerification({
    supportsConnectionRegistration,
  })

  /**
   * Test connection first for apps that support connection registration
   * If connection is not verified, redirect to choose-connection screen to connect
   * If connection is verified, register connection and create step
   *
   * For apps without connection registration, create step directly
   */
  const handleAddConnection = useCallback(
    async (response: Record<string, any>) => {
      const newConnectionId = response?.createConnection?.id as
        | string
        | undefined

      if (newConnectionId) {
        patchModalState({ isLoading: true })
        if (supportsConnectionRegistration) {
          const testResult = await testConnection(newConnectionId)
          // If connection is not verified and has an error message
          if (!testResult?.registrationVerified && !!testResult?.message) {
            await handleConnectionChange(newConnectionId, true)
            patchModalState({
              selectedConnectionId: newConnectionId,
              currentScreen: 'choose-connection',
              isLoading: false,
            })
            return
          } else {
            await onRegisterConnection(newConnectionId)
          }
        }
        // Create or update step at the end
        await onCreateOrUpdateStep(newConnectionId)
      }
    },
    [
      handleConnectionChange,
      onCreateOrUpdateStep,
      onRegisterConnection,
      patchModalState,
      supportsConnectionRegistration,
      testConnection,
    ],
  )

  const submitHandler: SubmitHandler<FieldValues> = useCallback(
    async (data) => {
      if (!steps) {
        return
      }

      setInProgress(true)
      setError(null)

      const response: Response = {
        key,
        fields: data,
      }

      let stepIndex = 0
      while (stepIndex < steps.length) {
        const step = steps[stepIndex]
        const variables = computeAuthStepVariables(step.arguments, response)

        try {
          const stepResponse = await processStep(step, variables)

          response[step.name] = stepResponse
        } catch (err) {
          const error = err as IJSONObject
          setError((error.graphQLErrors as IJSONObject[])?.[0])
          setInProgress(false)

          break
        }

        stepIndex++

        if (stepIndex === steps.length) {
          await handleAddConnection(response)
        }
      }

      setInProgress(false)
    },
    [key, steps, handleAddConnection],
  )

  const onBack = () => patchModalState({ currentScreen: 'choose-connection' })

  if (!selectedApp) {
    return <InvalidModalScreen />
  }

  return (
    <>
      <ModalHeader pt={0}>
        <Button
          variant="clear"
          colorScheme="secondary"
          size="xs"
          onClick={onBack}
          leftIcon={<BiChevronLeft />}
          ml={-4}
        >
          Back
        </Button>
      </ModalHeader>
      <ConnectionHeader
        selectedApp={selectedApp}
        headerText={
          connectionModalLabel?.addConnectionLabel ??
          DEFAULT_ADD_CONNECTION_LABEL
        }
      />
      <ModalCloseButton mt={2} size="xs" />

      <ModalBody mt={2}>
        {auth?.connectionType !== 'user-added' ? (
          <>
            <Text textStyle="h4">Error</Text>
            <Infobox variant="error">Connections are not supported</Infobox>
          </>
        ) : (
          <Flex flexDir="column" gap={2}>
            {authDocUrl && (
              <Infobox>
                <MarkdownRenderer
                  source={`Visit [our guide](${authDocUrl}) to learn how to connect ${name}.`}
                  components={infoboxMdComponents}
                />
              </Infobox>
            )}

            {error && (
              <Infobox variant="error">
                <Text textStyle="subhead-1">{error.message as string}</Text>
                {error.details && (
                  <Text textStyle="subhead-1" as="pre" whiteSpace="pre-wrap">
                    {JSON.stringify(error.details, null, 2)}
                  </Text>
                )}
              </Infobox>
            )}

            <Form onSubmit={submitHandler}>
              <Flex flexDir="column" gap={4}>
                {auth?.fields?.map((field: IField) => (
                  <InputCreator key={field.key} schema={field} />
                ))}

                <Button
                  type="submit"
                  isLoading={inProgress}
                  data-test="create-connection-button"
                  size="lg"
                  mt={2}
                >
                  Connect
                </Button>
              </Flex>
            </Form>
          </Flex>
        )}
      </ModalBody>
    </>
  )
}
