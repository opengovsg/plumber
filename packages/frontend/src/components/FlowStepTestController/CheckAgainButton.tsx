import { IExecutionStepMetadata, IStep } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { IconType } from 'react-icons'
import { BiChevronDown } from 'react-icons/bi'
import { PiRobot, PiUser } from 'react-icons/pi'
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

interface CheckAgainButtonProps {
  isUnstyledInfobox: boolean
  onClick: (testRunMetadata?: Record<string, unknown>) => void
  isLoading: boolean
  isDisabled: boolean
  step: IStep
  executionStepMetadata?: IExecutionStepMetadata
}

export function CheckAgainButton(props: CheckAgainButtonProps) {
  const { isUnstyledInfobox, onClick, isLoading, isDisabled, step } = props
  const isFormSgTrigger =
    step.appKey === 'formsg' && step.key === 'newSubmission'
  if (isFormSgTrigger) {
    return <FormSGCheckAgainButton {...props} />
  }
  return (
    <Button
      variant={isUnstyledInfobox ? 'solid' : 'outline'}
      onClick={() => onClick()}
      isLoading={isLoading}
      colorScheme={isUnstyledInfobox ? 'primary' : 'black'}
      size="sm"
      isDisabled={isDisabled}
      data-test="check-again-button"
    >
      Check step again
    </Button>
  )
}

/**
 * For UX reasons, we need to have a different button for FormSG.
 * The user flow goes like this:
 * - If user first connects the form, the button should be "Check step again"
 *   and display only mock data (no dropdown button)
 * - After the real submission is made, the button should be "Check again with submission"
 *   and display the dropdown button and real submission data
 * - If the user clicks on the dropdown button and select "Use mock data",
 *   the button should still show the dropdown and allow user to toggle between mock and real data
 */

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

function FormSGCheckAgainButton(props: CheckAgainButtonProps) {
  const {
    isUnstyledInfobox: isTransparentInfobox,
    onClick,
    isLoading,
    isDisabled,
    executionStepMetadata,
  } = props

  const { isMock = false, lastTestSubmissionDate } = executionStepMetadata ?? {}

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
    } else {
      return (
        <>
          <Icon as={PiUser} fontSize={20} mb={0.5} />
          <Text>Check with last submission</Text>
        </>
      )
    }
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

  return (
    <ButtonGroup
      isAttached
      isDisabled={isDisabled}
      size="sm"
      variant={isTransparentInfobox ? 'solid' : 'outline'}
      colorScheme={isTransparentInfobox ? 'primary' : 'black'}
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
