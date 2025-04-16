import type { IAction } from '@plumber/types'

import { BiFilterAlt, BiGitRepoForked, BiQuestionMark } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'

const TOOLBOX_ACTION_TO_ICON_MAP = {
  onlyContinueIf: BiFilterAlt,
  ifThen: BiGitRepoForked,
}

interface ToolboxEventProps {
  action: IAction
  onSelectAppEvent: () => void
  isDisabled: boolean
}

export default function ToolboxEvent(props: ToolboxEventProps): JSX.Element {
  const { action, isDisabled, onSelectAppEvent } = props
  return (
    <TouchableTooltip
      label={isDisabled ? 'This can only be used as the last step' : ''}
      placement="bottom"
      openDelay={100}
      closeDelay={100}
    >
      <Flex
        key={action.key}
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        onClick={() => !isDisabled && onSelectAppEvent()}
        opacity={isDisabled ? 0.5 : 1}
        _hover={{
          bg: 'interaction.muted.neutral.hover',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        _active={{
          bg: 'interaction.muted.neutral.active',
        }}
        _focus={{
          outline: 'none',
          boxShadow: isDisabled
            ? 'none'
            : '0 0 0 2px var(--chakra-colors-primary-500)',
        }}
        tabIndex={isDisabled ? -1 : 0} // Make focusable unless disabled
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSelectAppEvent()
          }
        }}
      >
        <Flex alignItems="center" gap={4}>
          <Icon
            boxSize={8}
            as={
              TOOLBOX_ACTION_TO_ICON_MAP[
                action.key as keyof typeof TOOLBOX_ACTION_TO_ICON_MAP
              ] ?? BiQuestionMark
            }
            color={isDisabled ? 'base.content.default' : 'primary.500'}
          />

          <Flex flexDir="column" gap={1}>
            <Text textStyle="subhead-1">{action.name}</Text>
            <Text textStyle="body-2">{action.description}</Text>
          </Flex>
        </Flex>
      </Flex>
    </TouchableTooltip>
  )
}
