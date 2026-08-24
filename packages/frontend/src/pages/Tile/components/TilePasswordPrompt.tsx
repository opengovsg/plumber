import { ApolloError, useMutation } from '@apollo/client'
import {
  Center,
  FormControl,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button, IconButton, Input } from '@opengovsg/design-system-react'
import { type FormEvent, useState } from 'react'
import { BiHide, BiShow } from 'react-icons/bi'

import { FORBIDDEN, RATE_LIMITED } from '@/config/errors'
import { VERIFY_TABLE_VIEW_PASSWORD } from '@/graphql/mutations/tiles/verify-table-view-password'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'

interface TilePasswordPromptProps {
  tableId: string
  tableName: string
  viewOnlyKey: string
  onSuccess: (token: string) => void
}

export default function TilePasswordPrompt({
  tableId,
  tableName,
  viewOnlyKey,
  onSuccess,
}: TilePasswordPromptProps): JSX.Element {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [verifyPassword, { loading }] = useMutation(
    VERIFY_TABLE_VIEW_PASSWORD,
    {
      context: {
        headers: { 'x-tiles-view-key': viewOnlyKey },
        autoSnackbar: false,
      },
    },
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    try {
      const { data } = await verifyPassword({
        variables: {
          input: { tableId, password },
        },
      })

      if (data?.verifyTableViewPassword) {
        onSuccess(data.verifyTableViewPassword)
      }
    } catch (error) {
      if (!(error instanceof ApolloError)) {
        setErrorMessage('Something went wrong. Please try again.')
        return
      }
      const { code } = parseGraphqlError(error)
      if (code === FORBIDDEN) {
        setErrorMessage('Incorrect password. Please try again.')
        return
      }
      if (code === RATE_LIMITED) {
        setErrorMessage(
          'Too many attempts. Please wait a while before trying again.',
        )
        return
      }
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <Center height="100vh" px={8}>
      <VStack spacing={6} maxW="400px" w="full">
        <VStack spacing={2}>
          <Text textStyle="h4" fontWeight="semibold" textAlign="center">
            {tableName}
          </Text>
          <Text
            textStyle="body-1"
            color="base.content.medium"
            textAlign="center"
          >
            This tile is password-protected. Enter the password to view.
          </Text>
        </VStack>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <VStack spacing={4} w="full">
            <FormControl isInvalid={!!errorMessage}>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {errorMessage && (
                <Text color="red.500" textStyle="body-2" mt={2}>
                  {errorMessage}
                </Text>
              )}
            </FormControl>

            <Button
              type="submit"
              w="full"
              isLoading={loading}
              isDisabled={!password}
            >
              Submit
            </Button>
          </VStack>
        </form>
      </VStack>
    </Center>
  )
}
