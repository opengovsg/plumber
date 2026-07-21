import { type FormEvent, useEffect, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import {
  Button,
  Infobox,
  ModalCloseButton,
} from '@opengovsg/design-system-react'

import { CREATE_CONNECTION } from '@/graphql/mutations/create-connection'
import { VERIFY_CONNECTION } from '@/graphql/mutations/verify-connection'

interface AddFormsgConnectionModalProps {
  isOpen: boolean
  prefillFormUrl?: string
  onClose: () => void
  onSuccess: (connectionLabel: string, connectionId: string) => void
}

export default function AddFormsgConnectionModal({
  isOpen,
  prefillFormUrl,
  onClose,
  onSuccess,
}: AddFormsgConnectionModalProps) {
  const [formUrl, setFormUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inProgress, setInProgress] = useState(false)

  const [createConnection] = useMutation(CREATE_CONNECTION)
  const [verifyConnection] = useMutation(VERIFY_CONNECTION)

  // Reset per open so a stale attempt doesn't leak into the next one.
  useEffect(() => {
    if (isOpen) {
      setFormUrl(prefillFormUrl ?? '')
      setSecretKey('')
      setErrorMessage(null)
    }
  }, [isOpen, prefillFormUrl])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formUrl.trim() || !secretKey.trim() || inProgress) {
      return
    }

    setInProgress(true)
    setErrorMessage(null)

    try {
      // No flowId: the AI Builder creates the connection before any pipe
      // exists, so this becomes a personal connection. The secret key goes
      // browser → GraphQL only and never through the chat route or the LLM.
      const { data: createData } = await createConnection({
        variables: {
          input: {
            key: 'formsg',
            formattedData: {
              formId: formUrl.trim(),
              privateKey: secretKey.trim(),
            },
          },
        },
      })

      const connectionId = createData?.createConnection?.id
      if (!connectionId) {
        throw new Error('Connection could not be created')
      }

      const { data: verifyData } = await verifyConnection({
        variables: { input: { id: connectionId } },
      })

      const label =
        (verifyData?.verifyConnection?.formattedData?.screenName as
          | string
          | undefined) ?? formUrl.trim()

      onSuccess(label, connectionId)
      onClose()
    } catch (err) {
      setErrorMessage(
        (err as Error).message ||
          'Something went wrong while connecting your form',
      )
    } finally {
      setInProgress(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="lg">
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            Add new form
            <ModalCloseButton isDisabled={inProgress} />
          </ModalHeader>
          <ModalBody display="flex" flexDirection="column" gap={4}>
            {errorMessage && (
              <Infobox variant="error">
                <Text textStyle="subhead-1">{errorMessage}</Text>
              </Infobox>
            )}

            <FormControl isRequired>
              <FormLabel mb={1}>Form URL</FormLabel>
              <Text textStyle="body-2" color="base.content.medium" mb={2}>
                Click share on your form and copy the link. It should be in the
                format: https://form.gov.sg/654ab1234abc1a012345f1e0b
              </Text>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://form.gov.sg/…"
                autoComplete="url"
                isDisabled={inProgress}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel mb={1}>Form Secret Key</FormLabel>
              <Text textStyle="body-2" color="base.content.medium" mb={2}>
                This is the key you downloaded/saved when you created the form
              </Text>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter your Secret Key here to continue"
                autoComplete="off"
                isDisabled={inProgress}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              type="submit"
              isLoading={inProgress}
              isDisabled={!formUrl.trim() || !secretKey.trim()}
            >
              Connect
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
