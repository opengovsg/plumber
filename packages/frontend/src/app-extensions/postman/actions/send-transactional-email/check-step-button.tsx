import { IconType } from 'react-icons'
import { BiChevronDown } from 'react-icons/bi'
import { PiAddressBook } from 'react-icons/pi'
import {
  ButtonGroup,
  Flex,
  Icon,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react'
import { Button, IconButton, Menu } from '@opengovsg/design-system-react'

import type { CheckStepButtonExtensionProps } from '@/app-extensions/types'

interface PostmanMenuItemProps {
  icon: IconType
  title: string
  description: string
  onClick: () => void
}

function PostmanMenuItem({
  icon,
  title,
  description,
  onClick,
}: PostmanMenuItemProps) {
  return (
    <MenuItem
      display="block"
      _hover={{
        bg: 'grey.100',
      }}
      onClick={onClick}
    >
      <Flex alignItems="center" gap={2}>
        <Icon as={icon} fontSize={20} mb={0.5} />
        <Text textStyle="body-1">{title}</Text>
      </Flex>
      <Text textStyle="body-2" mt={1} color="secondary.500">
        {description}
      </Text>
    </MenuItem>
  )
}

export default function PostmanCheckStepButton({
  buttonProps,
  onClick,
  executionStepMetadata,
}: CheckStepButtonExtensionProps) {
  const { isLoading, isDisabled, size, variant, colorScheme } = buttonProps
  const buttonText = executionStepMetadata
    ? 'Check step again with my email'
    : 'Check step with my email'

  return (
    <ButtonGroup
      isAttached
      isDisabled={isDisabled || isLoading}
      size={size}
      variant={variant}
      colorScheme={colorScheme}
    >
      <Button
        onClick={() => onClick({ useConfiguredEmails: false })}
        isLoading={isLoading}
        data-test="postman-check-step-button"
      >
        {buttonText}
      </Button>
      <Menu gutter={0} colorScheme="grey" autoSelect={false}>
        <MenuButton
          as={IconButton}
          icon={<BiChevronDown />}
          data-test="postman-check-step-button-dropdown"
        />
        <MenuList maxW="350px" py={0}>
          <PostmanMenuItem
            onClick={() => onClick({ useConfiguredEmails: true })}
            icon={PiAddressBook}
            title="Check step with configured emails"
            description="Recipients and CCs in this step will receive the email."
          />
        </MenuList>
      </Menu>
    </ButtonGroup>
  )
}
