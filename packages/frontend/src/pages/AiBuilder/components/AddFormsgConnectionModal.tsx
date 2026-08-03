import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'
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
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  Button,
  FormErrorMessage,
  FormLabel as RequiredFormLabel,
  Infobox,
  ModalCloseButton,
} from '@opengovsg/design-system-react'

import FileUpload from '@/components/FileUpload'
import { CREATE_CONNECTION } from '@/graphql/mutations/create-connection'
import { VERIFY_CONNECTION } from '@/graphql/mutations/verify-connection'

// Matches the format of a form's private key downloaded from FormSG, same
// check the editor's DragDropInput uses for the same field.
const SECRET_KEY_REGEX = /^[a-zA-Z0-9/+]+={0,2}$/

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
  const [secretKeyFileError, setSecretKeyFileError] = useState<string | null>(
    null,
  )
  const [dragging, setDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inProgress, setInProgress] = useState(false)

  const [createConnection] = useMutation(CREATE_CONNECTION)
  const [verifyConnection] = useMutation(VERIFY_CONNECTION)

  // Reset per open so a stale attempt doesn't leak into the next one.
  useEffect(() => {
    if (isOpen) {
      setFormUrl(prefillFormUrl ?? '')
      setSecretKey('')
      setSecretKeyFileError(null)
      setErrorMessage(null)
    }
  }, [isOpen, prefillFormUrl])

  // Only suppress the browser's default "open dropped file" behaviour while
  // this modal is actually open, since the component stays mounted (with
  // isOpen toggling) for the lifetime of the AI Builder page.
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const preventDefault = (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)
    return () => {
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
    }
  }, [isOpen])

  const processSecretKeyFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result?.toString()
      if (!text || !SECRET_KEY_REGEX.test(text)) {
        setSecretKeyFileError('Selected file seems to be invalid')
        return
      }
      setSecretKeyFileError(null)
      setSecretKey(text)
    }
    reader.readAsText(file)
  }, [])

  const preventDefaults = (e: ReactDragEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: ReactDragEvent<HTMLInputElement>) => {
    preventDefaults(e)
    setDragging(true)
  }

  const handleDragOver = (e: ReactDragEvent<HTMLInputElement>) => {
    preventDefaults(e)
  }

  const handleDragLeave = (e: ReactDragEvent<HTMLInputElement>) => {
    preventDefaults(e)
    setDragging(false)
  }

  const handleDrop = (e: ReactDragEvent<HTMLInputElement>) => {
    preventDefaults(e)
    setDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) {
      return
    }
    processSecretKeyFile(file)
  }

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

            <FormControl isInvalid={!!secretKeyFileError}>
              <RequiredFormLabel isRequired mb={1}>
                Form Secret Key
              </RequiredFormLabel>
              <Text textStyle="body-2" color="base.content.medium" mb={2}>
                This is the key you downloaded/saved when you created the form
              </Text>
              <Stack spacing="0.5rem" direction="row">
                <Input
                  type="password"
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKeyFileError(null)
                    setSecretKey(e.target.value)
                  }}
                  {...(dragging
                    ? {
                        py: 12,
                        backgroundColor: 'primary.50',
                        borderColor: 'primary.500',
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        _focusVisible: {
                          boxShadow: 'none',
                        },
                      }
                    : undefined)}
                  onDragEnter={inProgress ? undefined : handleDragEnter}
                  onDragLeave={inProgress ? undefined : handleDragLeave}
                  onDragOver={inProgress ? undefined : handleDragOver}
                  onDrop={inProgress ? undefined : handleDrop}
                  placeholder={
                    dragging
                      ? 'Drop your file here'
                      : 'Enter or drop your Secret Key here to continue'
                  }
                  autoComplete="off"
                  isDisabled={inProgress}
                  transition="padding 0.2s ease-out"
                />
                <FileUpload
                  accept="text/plain"
                  processFile={processSecretKeyFile}
                  disabled={inProgress}
                />
              </Stack>
              {secretKeyFileError && (
                <FormErrorMessage>{secretKeyFileError}</FormErrorMessage>
              )}
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
