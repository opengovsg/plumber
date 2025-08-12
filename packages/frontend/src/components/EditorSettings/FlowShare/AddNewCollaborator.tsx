import { IFlow, IFlowCollabRole } from '@plumber/types'

import { BaseSyntheticEvent, useCallback, useEffect, useState } from 'react'
import { FieldValues, useForm } from 'react-hook-form'
import {
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  VStack,
} from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import { Button, Input } from '@opengovsg/design-system-react'
import * as yup from 'yup'

import CollaboratorRoleSelect from '@/components/CollaboratorRoleSelect'

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
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<IFlowCollabRole>('editor')
  const [isAdding, setIsAdding] = useState(false)
  const [debouncedIsValid, setDebouncedIsValid] = useState(false)

  const {
    register,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm({
    resolver: yupResolver(inputSchema),
  })

  // Debounce isValid to prevent connections infoboxes from appearing/disappearing while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIsValid(isValid)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [isValid])

  const onSubmit = useCallback(
    async (data: FieldValues, event?: BaseSyntheticEvent) => {
      try {
        event?.preventDefault()
        setIsAdding(true)
        await onAdd(data.email, role)
        setEmail('')
      } finally {
        setIsAdding(false)
      }
    },
    [onAdd, role],
  )

  return (
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
          {role === 'editor' && debouncedIsValid && <SharedConnections />}

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
  )
}

export default AddNewCollaborator
