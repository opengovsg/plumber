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
import { useCallback, useMemo } from 'react'
import { IconType } from 'react-icons'
import { BiChevronDown } from 'react-icons/bi'
import { PiRobot, PiUser } from 'react-icons/pi'

import type { CheckStepButtonExtensionProps } from '@/app-extensions/types'

interface FormSGMenuItemProps {
  icon: IconType
  title: string
  description: string
  isSelected: boolean
  onClick: () => void
}

function FormSGMenuItem({
  icon,
  title,
  description,
  isSelected,
  onClick,
}: FormSGMenuItemProps) {
  return (
    <MenuItem
      display="block"
      bg={isSelected ? 'primary.50' : undefined}
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

export default function FormSGCheckAgainButton({
  buttonProps,
  onClick,
  executionStepMetadata,
  children,
}: CheckStepButtonExtensionProps) {
  const { isMock = false, lastTestSubmissionDate } = executionStepMetadata ?? {}
  const { isLoading, isDisabled, size, variant, colorScheme } = buttonProps

  const buttonText = useMemo(() => {
    if (!lastTestSubmissionDate) {
      return <Text>Check step again</Text>
    }
    if (isMock) {
      return (
        <>
          <Icon as={PiRobot} fontSize={20} mb={0.5} />
          <Text>Check with mock data</Text>
        </>
      )
    }
    return (
      <>
        <Icon as={PiUser} fontSize={20} mb={0.5} />
        <Text>Check with last submission</Text>
      </>
    )
  }, [lastTestSubmissionDate, isMock])

  const onTestClick = useCallback(() => {
    if (!lastTestSubmissionDate) {
      return onClick()
    }
    if (isMock) {
      return onClick({ preferMock: true })
    }
    return onClick({ preferMock: false })
  }, [lastTestSubmissionDate, isMock, onClick])

  if (!executionStepMetadata) {
    return children
  }

  return (
    <ButtonGroup
      isAttached
      isDisabled={isDisabled}
      size={size}
      variant={variant}
      colorScheme={colorScheme}
    >
      <Button
        onClick={onTestClick}
        isLoading={isLoading}
        gap={2}
        data-test="formsg-check-again-button"
      >
        {buttonText}
      </Button>
      {lastTestSubmissionDate && (
        <Menu gutter={0} colorScheme="grey">
          <MenuButton
            as={IconButton}
            icon={<BiChevronDown />}
            isLoading={isLoading}
            data-test="formsg-check-again-button-dropdown"
          />
          <MenuList maxW="350px">
            <FormSGMenuItem
              onClick={() => onClick({ preferMock: true })}
              icon={PiRobot}
              title="Use mock data"
              description="Mock responses will be generated based on your form fields"
              isSelected={isMock}
            />
            <FormSGMenuItem
              onClick={() => onClick({ preferMock: false })}
              icon={PiUser}
              title="Use last submission"
              description="The last form submission when this pipe is unpublished will be used"
              isSelected={!isMock}
            />
          </MenuList>
        </Menu>
      )}
    </ButtonGroup>
  )
}
