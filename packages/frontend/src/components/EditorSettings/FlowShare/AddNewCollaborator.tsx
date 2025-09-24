import { IFlow, IFlowCollabRole } from '@plumber/types'

import { BaseSyntheticEvent, useCallback, useRef, useState } from 'react'
import { FieldValues, useForm } from 'react-hook-form'
import {
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import { Button, Input } from '@opengovsg/design-system-react'
import * as yup from 'yup'

import CollaboratorRoleSelect from '@/components/CollaboratorRoleSelect'
import MenuAlertDialog from '@/components/MenuAlertDialog'

import SharedConnections from './SharedConnections'

const inputSchema = yup
  .object({
    email: yup
      .string()
      .email('Invalid email address')
      .required('Email is required'),
  })
  .required()

const AddNewCollaborator = ({
  flow,
  onAdd,
}: {
  flow: IFlow
  onAdd: (email: string, role: string) => Promise<void>
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<IFlowCollabRole>('editor')
  const [isAdding, setIsAdding] = useState(false)

  const { isOpen, onOpen, onClose } = useDisclosure()

  const {
    register,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm({
    resolver: yupResolver(inputSchema),
  })

  const onSubmit = useCallback(
    async (data: FieldValues, event?: BaseSyntheticEvent) => {
      try {
        event?.preventDefault()
        if (role === 'editor') {
          onOpen()
        } else {
          setIsAdding(true)
          await onAdd(data.email, role)
          setEmail('')
          setIsAdding(false)
        }
      } catch (error) {
        console.error(error)
      }
    },
    [onAdd, onOpen, role],
  )

  const onConfirm = useCallback(async () => {
    setIsAdding(true)
    await onAdd(email, role)
    setEmail('')
    onClose()
    setIsAdding(false)
  }, [onAdd, email, role, onClose])

  return (
    <>
      <form
        style={{
          width: '100%',
        }}
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormControl isInvalid={!isValid}>
          <FormLabel>Add collaborator</FormLabel>
          <VStack spacing={2} alignItems="flex-start">
            <Flex alignSelf="stretch" gap={2}>
              <Input
                type="email"
                value={email}
                isRequired
                {...register('email', {
                  onChange: (e) => {
                    setEmail(e.target.value.toLowerCase())
                  },
                })}
              />
              <CollaboratorRoleSelect
                userRole={flow.role as IFlowCollabRole}
                value={role}
                onChange={setRole}
                isEditable={true}
                showOwnerOption={false}
              />
            </Flex>
            {isDirty && !isValid && (
              <FormErrorMessage>
                Please enter a valid email address.
              </FormErrorMessage>
            )}

            {/* Connections appear if pipe is unpublished */}
            {role === 'editor' && <SharedConnections />}

            <Button
              variant={role === 'owner' ? 'solid' : 'outline'}
              colorScheme="red"
              type="submit"
              isLoading={isAdding}
              isDisabled={!isValid}
            >
              Add collaborator
            </Button>
          </VStack>
        </FormControl>
      </form>

      {/* dialog to warn user that connections will be shared with editors */}
      <MenuAlertDialog
        cancelRef={cancelRef}
        isLoading={isAdding}
        isDialogOpen={isOpen}
        onDialogClose={onClose}
        dialogType="share-connections"
        dialogHeader="Share connections"
        onClick={onConfirm}
        customBody={`You are adding **${email.replace(
          '@',
          '@\u200B', // add zero-width space after @ to prevent email address rendering as an external link
        )}** as an editor. They will have access to your connections and will be able to use them in this Pipe.`}
      />
    </>
  )
}

export default AddNewCollaborator
