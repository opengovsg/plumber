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
  // A connection can only be created once the pipe exists (see
  // AiBuilder/index.tsx's onAddConnection/onConnectForm gating) — this is
  // that pipe's id. Only meaningful for the 'full' variant, the only one
  // that calls createConnection.
  flowId?: string
  // 'url-only': pre-pipe "Connect your form" pill — collects just the URL,
  // no secret key, no connection row (see onSubmitUrl).
  // 'full': URL + secret key, creates a real connection (see onSuccess).
  variant: 'url-only' | 'full'
  prefillFormUrl?: string
  // The URL is already known from the conversation and hard-locked to that
  // form — only reachable for the 'full' variant's key-completion path.
  lockFormUrl?: boolean
  onClose: () => void
  onSuccess: (connectionLabel: string, connectionId: string) => void
  onSubmitUrl: (formUrl: string) => void
}

export default function AddFormsgConnectionModal({
  isOpen,
  flowId,
  variant,
  prefillFormUrl,
  lockFormUrl,
  onClose,
  onSuccess,
  onSubmitUrl,
}: AddFormsgConnectionModalProps) {
  const [formUrl, setFormUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [secretKeyError, setSecretKeyError] = useState<string | null>(null)
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
      setSecretKeyError(null)
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
        setSecretKeyError('Selected file seems to be invalid')
        return
      }
      setSecretKeyError(null)
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
    if (inProgress) {
      return
    }

    // No client-side format gate here — the backend (get_form_schema for
    // url-only, verifyCredentials for full) is deliberately more lenient
    // than any regex we could write (protocol-optional, any *.form.gov.sg
    // path shape) and already surfaces a clear error either way.
    const trimmedUrl = formUrl.trim()
    if (!trimmedUrl) {
      return
    }

    if (variant === 'url-only') {
      onSubmitUrl(trimmedUrl)
      onClose()
      return
    }

    const trimmedSecretKey = secretKey.trim()
    if (!trimmedSecretKey || !flowId) {
      return
    }

    // Only the drag/drop file path validates the secret key's format today —
    // typed/pasted input needs the same check, or malformed input reaches
    // createConnection/verifyConnection unfiltered.
    if (!SECRET_KEY_REGEX.test(trimmedSecretKey)) {
      setSecretKeyError('Invalid secret key format')
      return
    }

    setInProgress(true)
    setErrorMessage(null)

    try {
      // The secret key goes browser → GraphQL only and never through the
      // chat route or the LLM.
      const { data: createData } = await createConnection({
        variables: {
          input: {
            key: 'formsg',
            formattedData: {
              formId: trimmedUrl,
              privateKey: trimmedSecretKey,
            },
            flowId,
          },
        },
      })

      const connectionId = createData?.createConnection?.id
      if (!connectionId) {
        throw new Error('Connection could not be created')
      }

      const { data: verifyData } = await verifyConnection({
        variables: { input: { id: connectionId, flowId } },
      })

      const label =
        (verifyData?.verifyConnection?.formattedData?.screenName as
          | string
          | undefined) ?? trimmedUrl

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

  const modalTitle =
    variant === 'url-only'
      ? 'Share your form'
      : lockFormUrl
      ? 'Add your Form Secret Key'
      : 'Add new form'

  // The URL stays locked only while it hasn't failed yet — once the backend
  // rejects it (e.g. "Form does not exist"), the user needs to be able to
  // correct it rather than being stuck resubmitting the same bad URL.
  const isFormUrlLocked = lockFormUrl && !errorMessage

  const isSubmitDisabled =
    !formUrl.trim() || (variant === 'full' && (!secretKey.trim() || !flowId))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      isCentered
      closeOnOverlayClick={!inProgress}
      closeOnEsc={!inProgress}
    >
      <ModalOverlay />
      <ModalContent borderRadius="lg">
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            {modalTitle}
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
                format: https://form.gov.sg/654ab1234abc1a012345f1e0
              </Text>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://form.gov.sg/…"
                autoComplete="url"
                isDisabled={inProgress || isFormUrlLocked}
              />
            </FormControl>

            {variant === 'full' && (
              <FormControl isInvalid={!!secretKeyError}>
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
                      setSecretKeyError(null)
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
                {secretKeyError && (
                  <FormErrorMessage>{secretKeyError}</FormErrorMessage>
                )}
              </FormControl>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="submit"
              isLoading={inProgress}
              isDisabled={isSubmitDisabled}
            >
              {variant === 'url-only' ? 'Share' : 'Connect'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
