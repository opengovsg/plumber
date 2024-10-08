import { useCallback, useState } from 'react'
import { BiCopy } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  Divider,
  Flex,
  FormControl,
  InputGroup,
  InputRightAddon,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Button,
  FormHelperText,
  IconButton,
  Input,
} from '@opengovsg/design-system-react'
import copy from 'clipboard-copy'

import * as URLS from '@/config/urls'
import { CREATE_SHAREABLE_TABLE_LINK } from '@/graphql/mutations/tiles/create-shareable-link'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import { useTableContext } from '../../contexts/TableContext'

const ShareLink = () => {
  const { tableId, viewOnlyKey, hasEditPermission } = useTableContext()
  const [isNewLink, setIsNewLink] = useState(false)

  const shareableLink = viewOnlyKey
    ? `${window.location.origin}${URLS.TILE(tableId)}/${viewOnlyKey}`
    : ''

  const [createNewLink, { loading }] = useMutation(
    CREATE_SHAREABLE_TABLE_LINK,
    {
      variables: {
        tableId,
      },
      refetchQueries: [GET_TABLE],
    },
  )

  const onGenerate = useCallback(async () => {
    await createNewLink()
    setIsNewLink(true)
  }, [createNewLink])

  const inputBorderColor = isNewLink ? 'green.400' : 'secondary.200'

  if (!viewOnlyKey && !hasEditPermission) {
    return null
  }
  return (
    <FormControl>
      <VStack spacing={2} alignItems="flex-start">
        <Text textStyle="subhead-3">General Access</Text>
        <Text textStyle="body-1">
          {hasEditPermission
            ? 'Generate a shareable link to allow'
            : 'This shareable link allows'}{' '}
          viewing and exporting only. No login required.
        </Text>
        <Flex alignSelf="stretch" gap={2}>
          {viewOnlyKey && (
            <InputGroup borderWidth={0}>
              <Input
                value={shareableLink}
                borderRightWidth={0}
                paddingRight={0}
                borderColor={inputBorderColor}
                _focusVisible={{ borderColor: inputBorderColor }}
                isReadOnly
              />
              <InputRightAddon
                padding={0}
                background="white"
                borderColor={inputBorderColor}
              >
                <IconButton
                  icon={<BiCopy />}
                  colorScheme="secondary"
                  variant="clear"
                  aria-label={'Copy'}
                  onClick={() => copy(shareableLink ?? '')}
                />
              </InputRightAddon>
            </InputGroup>
          )}
          {hasEditPermission && (
            <Button variant="outline" isLoading={loading} onClick={onGenerate}>
              Generate new link
            </Button>
          )}
        </Flex>
        {viewOnlyKey && hasEditPermission && (
          <FormHelperText variant={isNewLink ? 'success' : undefined}>
            {isNewLink
              ? 'New link generated!'
              : 'By generating a new link, your previous link will not work anymore.'}
          </FormHelperText>
        )}
      </VStack>
      <Divider my={6} />
    </FormControl>
  )
}

export default ShareLink
