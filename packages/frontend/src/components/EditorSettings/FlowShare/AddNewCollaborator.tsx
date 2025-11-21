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
  const [role, setRole] = useState<IFlowCollabRole>('editor')
  const [isAdding, setIsAdding] = useState(false)

  const { isOpen, onOpen, onClose } = useDisclosure()

  const {
    register,
    formState: { isValid, isSubmitted, errors },
    handleSubmit,
    getValues,
    resetField,
  } = useForm({
    resolver: yupResolver(inputSchema),
  })

  const onSubmit = useCallback(
    async (data: FieldValues, event?: BaseSyntheticEvent) => {
      try {
        event?.preventDefault()
        const email = getValues('email')
        if (role === 'editor') {
          onOpen()
        } else {
          setIsAdding(true)
          await onAdd(email, role)
          resetField('email')
          setIsAdding(false)
        }
      } catch (error) {
        console.error(error)
      }
    },
    [onAdd, onOpen, role, getValues, resetField],
  )

  const onConfirm = useCallback(async () => {
    try {
      setIsAdding(true)
      const email = getValues('email')
      await onAdd(email, role)
      resetField('email')
    } catch (error) {
      console.error(error)
    } finally {
      onClose()
      setIsAdding(false)
    }
  }, [onAdd, getValues, role, onClose, resetField])

  return (
    <>
      <form
        style={{
          width: '100%',
        }}
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormControl isInvalid={isSubmitted && !isValid}>
          <FormLabel>Add collaborator</FormLabel>
          <VStack spacing={2} alignItems="flex-start">
            <Flex alignSelf="stretch" gap={2}>
              <Input type="email" isRequired {...register('email')} />
              <CollaboratorRoleSelect
                userRole={flow.role as IFlowCollabRole}
                value={role}
                onChange={setRole}
                isEditable={true}
                showOwnerOption={false}
              />
            </Flex>
            {isSubmitted && errors?.email && (
              <FormErrorMessage>
                Please enter a valid email address.
              </FormErrorMessage>
            )}

            {/* Connections appear if pipe is unpublished */}
            {role === 'editor' && <SharedConnections />}

            <Button
              type="submit"
              isLoading={isAdding}
              isDisabled={!isValid}
              alignSelf="flex-end"
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
        customBody={`You are adding **${getValues('email')?.replace(
          '@',
          '@\u200B', // add zero-width space after @ to prevent email address rendering as an external link
        )}** as an editor. They will have access to your connections and will be able to use them in this Pipe.`}
      />
    </>
  )
}

export default AddNewCollaborator
