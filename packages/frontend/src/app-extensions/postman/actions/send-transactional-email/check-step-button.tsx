import { type ReactNode, useContext } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Box, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react'
import { Button, Menu } from '@opengovsg/design-system-react'

import type { CheckStepButtonExtensionProps } from '@/app-extensions/types'
import { simpleSubstitute } from '@/components/RichTextEditor/utils'
import { AuthenticationContext } from '@/contexts/Authentication'
import { EditorContext } from '@/contexts/Editor'

interface PostmanMenuItemProps {
  title: string
  description: ReactNode
  onClick: () => void
  isDisabled?: boolean
}

function PostmanMenuItem({
  title,
  description,
  onClick,
  isDisabled,
}: PostmanMenuItemProps) {
  return (
    <MenuItem
      display="block"
      isDisabled={isDisabled}
      _hover={isDisabled ? undefined : { bg: 'primary.50' }}
      onClick={onClick}
    >
      <Text textStyle="body-1">{title}</Text>
      <Box textStyle="body-2" mt={1} color="base.content.medium">
        {description}
      </Box>
    </MenuItem>
  )
}

export default function PostmanCheckStepButton({
  step,
  buttonProps,
  onClick,
  executionStepMetadata,
}: CheckStepButtonExtensionProps) {
  const { isLoading, isDisabled } = buttonProps
  const { varInfoMap } = useContext(EditorContext)
  const { currentUser } = useContext(AuthenticationContext)
  const { control } = useFormContext()

  const buttonText = executionStepMetadata
    ? 'Check step again...'
    : 'Check step...'

  // Mirror the email preview: resolve any variables in the recipient/CC fields
  // using the latest test-run values. Read the live form inputs so the preview
  // reflects edits the user hasn't saved yet, falling back to the saved params
  // when a field isn't registered (e.g. before the form mounts).
  const liveDestinationEmail = useWatch({
    control,
    name: 'parameters.destinationEmail',
  })
  const liveDestinationEmailCc = useWatch({
    control,
    name: 'parameters.destinationEmailCc',
  })
  const substituteEmails = (value: unknown) =>
    typeof value === 'string' ? simpleSubstitute(value, varInfoMap).trim() : ''
  const toEmails = substituteEmails(
    liveDestinationEmail ?? step.parameters.destinationEmail,
  )
  const ccEmails = substituteEmails(
    liveDestinationEmailCc ?? step.parameters.destinationEmailCc,
  )
  const hasConfiguredEmails = Boolean(toEmails || ccEmails)

  return (
    <Menu gutter={4} colorScheme="grey" autoSelect={false}>
      <MenuButton
        as={Button}
        {...buttonProps}
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        data-test="postman-check-step-button"
      >
        {buttonText}
      </MenuButton>
      <MenuList maxW="350px" py={0}>
        <Box px={4} pt={3} pb={2}>
          <Text textStyle="subhead-2">Send test email to</Text>
        </Box>
        <PostmanMenuItem
          onClick={() => onClick({ useConfiguredEmails: false })}
          title="Myself"
          description={<Text noOfLines={1}>{currentUser?.email}</Text>}
        />
        <PostmanMenuItem
          onClick={() => onClick({ useConfiguredEmails: true })}
          title="Emails entered as recipients/CC"
          description={
            hasConfiguredEmails ? (
              <>
                <Text noOfLines={1}>{toEmails}</Text>
                {ccEmails ? <Text noOfLines={1}>{ccEmails}</Text> : null}
              </>
            ) : (
              'No recipients entered yet'
            )
          }
          isDisabled={!hasConfiguredEmails}
        />
      </MenuList>
    </Menu>
  )
}
