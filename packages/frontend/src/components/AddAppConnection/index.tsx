import type { IApp, IField, IJSONObject } from '@plumber/types'

import * as React from 'react'
import { FieldValues, SubmitHandler } from 'react-hook-form'
import { useMutation, useQuery } from '@apollo/client'
import {
  Alert,
  AlertIcon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button, Infobox, Link } from '@opengovsg/design-system-react'

import InputCreator from '@/components/InputCreator'
import { REPLACE_CONNECTION_CREDENTIALS } from '@/graphql/mutations/replace-connection-credentials'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import { processStep } from '@/helpers/authenticationSteps'
import computeAuthStepVariables from '@/helpers/computeAuthStepVariables'
import {
  getConnectionEnvLabel,
  getEditableConnectionLabel,
} from '@/helpers/connection-label'
import { getOpenerOrigin } from '@/helpers/window'

import Form from '../Form'

type AddAppConnectionProps = {
  onClose: (response: Record<string, unknown>) => void
  application: IApp
  connectionId?: string
}

type Response = {
  [key: string]: any
}

const LABEL_FIELD_KEYS = new Set(['screenName', 'label'])

/**
 * TODO: deprecate this component, we only need to support the callback route
 * /app/:appKey/connections/add
 */
export default function AddAppConnection(
  props: AddAppConnectionProps,
): React.ReactElement {
  const { application, connectionId, onClose } = props
  const { name, authDocUrl, key, auth } = application
  const [error, setError] = React.useState<IJSONObject | null>(null)
  const [inProgress, setInProgress] = React.useState(false)
  const [replaceConnectionCredentials] = useMutation(
    REPLACE_CONNECTION_CREDENTIALS,
  )
  const hasConnection = Boolean(connectionId)
  const steps = auth?.authenticationSteps

  const { data: connectionsData, loading: connectionLoading } = useQuery(
    GET_APP_CONNECTIONS,
    {
      variables: { key },
      skip: !connectionId,
    },
  )

  const editingConnection = connectionsData?.getApp?.connections?.find(
    (connection: { id?: string }) => connection.id === connectionId,
  )
  const storedScreenName = editingConnection?.formattedData?.screenName
  const labelDefault = getEditableConnectionLabel(
    key,
    storedScreenName?.toString(),
  )
  const envLabel = getConnectionEnvLabel(
    editingConnection?.formattedData?.env?.toString(),
  )

  const defaultValues = React.useMemo(() => {
    if (!hasConnection || !labelDefault) {
      return undefined
    }

    return {
      screenName: labelDefault,
      label: labelDefault,
    }
  }, [hasConnection, labelDefault])

  React.useEffect(() => {
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

  const submitHandler: SubmitHandler<FieldValues> = React.useCallback(
    async (data) => {
      if (hasConnection && connectionId) {
        setInProgress(true)
        setError(null)

        try {
          const result = await replaceConnectionCredentials({
            variables: {
              input: {
                id: connectionId,
                formattedData: data,
              },
            },
            context: {
              autoSnackbar: false,
            },
          })

          onClose({
            replaceConnectionCredentials:
              result.data?.replaceConnectionCredentials,
          })
        } catch (err) {
          const mutationError = err as IJSONObject
          setError((mutationError.graphQLErrors as IJSONObject[])?.[0])
        } finally {
          setInProgress(false)
        }

        return
      }

      if (!steps) {
        return
      }

      setInProgress(true)
      setError(null)

      const response: Response = {
        key,
        connection: {
          id: connectionId,
        },
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
          onClose(response)
        }
      }

      setInProgress(false)
    },
    [
      connectionId,
      hasConnection,
      key,
      onClose,
      replaceConnectionCredentials,
      steps,
    ],
  )

  if (auth?.connectionType !== 'user-added') {
    return (
      <Modal isOpen={true} onClose={() => onClose({})}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Error</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={8}>
            <Infobox variant="error">
              Editing this connection is not supported
            </Infobox>
          </ModalBody>
        </ModalContent>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={() => onClose({})}
      data-test="add-app-connection-dialog"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {hasConnection ? 'Edit connection' : 'Add connection'}
        </ModalHeader>
        <ModalCloseButton />

        {authDocUrl && (
          <Alert status="info" fontWeight="300" px={8}>
            <AlertIcon />
            Visit our
            <Link isExternal href={authDocUrl} target="_blank" mx={1}>
              guide
            </Link>
            to learn more about how to connect {name}.
          </Alert>
        )}

        {error && (
          <Alert
            status="error"
            mt={1}
            fontWeight="500"
            wordBreak="break-all"
            px={8}
          >
            <AlertIcon />
            <>
              {error.message}
              {error.details && (
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              )}
            </>
          </Alert>
        )}

        <ModalBody>
          {hasConnection && connectionLoading ? null : (
            <Form defaultValues={defaultValues} onSubmit={submitHandler}>
              <VStack gap={4} pt={4} pb={8} alignItems="stretch">
                {hasConnection && key === 'telegram-bot' ? (
                  <Infobox>
                    The connection name is taken from the bot after you save.
                  </Infobox>
                ) : null}

                {hasConnection && envLabel ? (
                  <Text textStyle="body-2" color="base.content.medium">
                    Environment: {envLabel}
                  </Text>
                ) : null}

                {auth?.fields?.map((field: IField) => (
                  <InputCreator
                    key={field.key}
                    schema={
                      LABEL_FIELD_KEYS.has(field.key) && labelDefault
                        ? { ...field, value: labelDefault }
                        : field
                    }
                  />
                ))}

                <Button
                  type="submit"
                  variant="solid"
                  colorScheme="primary"
                  isLoading={inProgress}
                  data-test="create-connection-button"
                  isFullWidth
                >
                  {hasConnection ? 'Update connection' : 'Connect'}
                </Button>
              </VStack>
            </Form>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
