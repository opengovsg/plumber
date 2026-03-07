import { useCallback, useState } from 'react'
import { BiCheck, BiHide, BiPencil, BiShow, BiX } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  Flex,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Checkbox,
  FormHelperText,
  IconButton,
  Input,
} from '@opengovsg/design-system-react'

import { DELETE_TABLE_VIEW_PASSWORD } from '@/graphql/mutations/tiles/delete-table-view-password'
import { SET_TABLE_VIEW_PASSWORD } from '@/graphql/mutations/tiles/set-table-view-password'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import { useTableContext } from '../../contexts/TableContext'

/**
 * Password protection section for shareable table links.
 * - isPasswordProtected (from context): server state, true when a password is set.
 * - isEditing: local state, true when the set/change password form is open.
 * - Checkbox checked is derived: isPasswordProtected || isEditing.
 */
const ShareLinkPasswordSection = () => {
  const { tableId, viewOnlyKey, isPasswordProtected, hasEditPermission } =
    useTableContext()
  const [isEditing, setIsEditing] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }, [])

  const [setPassword, { loading: isSettingPassword }] = useMutation(
    SET_TABLE_VIEW_PASSWORD,
    {
      refetchQueries: [GET_TABLE],
      update(cache, _result, { variables }) {
        // optimistically update cache to prevent flicker
        const tableId = variables?.input?.tableId
        if (!tableId) {
          return
        }
        const existing = cache.readQuery<{
          getTable: { isPasswordProtected?: boolean; [key: string]: unknown }
        }>({ query: GET_TABLE, variables: { tableId } })
        if (!existing?.getTable) {
          return
        }
        cache.writeQuery({
          query: GET_TABLE,
          variables: { tableId },
          data: {
            getTable: {
              ...existing.getTable,
              isPasswordProtected: true,
            },
          },
        })
      },
    },
  )

  const [deletePassword, { loading: isDeletingPassword }] = useMutation(
    DELETE_TABLE_VIEW_PASSWORD,
    {
      variables: { tableId },
      refetchQueries: [GET_TABLE],
      // optimistic return success to prevent flicker
      optimisticResponse: {
        deleteTableViewPassword: true,
      },
    },
  )

  const onSetPassword = useCallback(async () => {
    if (!passwordInput) {
      return
    }
    await setPassword({
      variables: { input: { tableId, password: passwordInput } },
    })
    setPasswordInput('')
    setShowPassword(false)
    setIsEditing(false)
    showSuccess(isPasswordProtected ? 'Password updated!' : 'Password set!')
  }, [passwordInput, setPassword, tableId, isPasswordProtected, showSuccess])

  const onRemovePassword = useCallback(async () => {
    await deletePassword()
    showSuccess('Password removed!')
  }, [deletePassword, showSuccess])

  const onCancelEdit = useCallback(() => {
    setIsEditing(false)
    setPasswordInput('')
    setShowPassword(false)
  }, [])

  const onCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked
      if (checked) {
        setIsEditing(true)
      } else {
        if (isPasswordProtected) {
          onRemovePassword()
        }
        setIsEditing(false)
        setPasswordInput('')
      }
    },
    [isPasswordProtected, onRemovePassword],
  )

  if (!viewOnlyKey || !hasEditPermission) {
    return null
  }

  const isCheckboxChecked = isPasswordProtected || isEditing

  return (
    <VStack
      spacing={2}
      alignItems="flex-start"
      w="full"
      justifyContent="stretch"
    >
      <Flex gap={2} alignItems="center">
        <Checkbox
          isChecked={isCheckboxChecked}
          onChange={onCheckboxChange}
          isDisabled={isDeletingPassword}
        >
          <Text textStyle="subhead-3">Password protection</Text>
        </Checkbox>
      </Flex>

      {isCheckboxChecked && (
        <Flex alignSelf="stretch" gap={2} alignItems="center" pl={10} w="full">
          {isPasswordProtected && !isEditing ? (
            <>
              <Input
                type="password"
                value="••••••••••••••••••••"
                isReadOnly
                placeholder="Password set"
              />

              <IconButton
                icon={<BiPencil />}
                variant="outline"
                size="md"
                aria-label="Change password"
                onClick={() => setIsEditing(true)}
              />
            </>
          ) : (
            <>
              <InputGroup flex={1}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={'Enter a new password (min 8 characters)'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && passwordInput) {
                      onSetPassword()
                    }
                  }}
                  autoFocus
                  pr="10"
                />
                <InputRightElement>
                  <IconButton
                    icon={showPassword ? <BiHide /> : <BiShow />}
                    variant="clear"
                    size="sm"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() => setShowPassword((p) => !p)}
                  />
                </InputRightElement>
              </InputGroup>
              <IconButton
                icon={<BiCheck />}
                variant="solid"
                aria-label="Save"
                size="md"
                isLoading={isSettingPassword}
                isDisabled={!passwordInput || passwordInput.length < 8}
                onClick={onSetPassword}
              />
              <IconButton
                icon={<BiX />}
                variant="clear"
                aria-label="Cancel"
                onClick={onCancelEdit}
              />
            </>
          )}
        </Flex>
      )}
      {successMessage && (
        <FormHelperText pl={10} variant="success">
          {successMessage}
        </FormHelperText>
      )}
    </VStack>
  )
}

export default ShareLinkPasswordSection
