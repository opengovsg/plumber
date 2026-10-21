import { Badge, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'

import { POPOVER_OPACITY_MOTION_PROPS } from '@/theme/constants'

interface VariablePillProps {
  label: string
  value?: string
  stepName?: string
}

export default function VariablePill({
  label,
  value,
  stepName,
}: VariablePillProps) {
  const hasValue = Boolean(value)

  return (
    <TouchableTooltip
      motionProps={POPOVER_OPACITY_MOTION_PROPS}
      label={stepName}
      aria-label="variable pill tooltip"
    >
      <Badge
        maxW="full"
        variant="solid"
        borderRadius="50px"
        px={3}
        py={1}
        cursor="default"
        bg="primary.100"
        fontSize="sm"
      >
        <Text
          as="span"
          isTruncated
          maxW={hasValue ? '20ch' : 'full'}
          color="base.content.strong"
          mr={hasValue ? '0.25rem' : undefined}
        >
          {label}
        </Text>
        {hasValue && (
          <Text as="span" isTruncated maxW="40ch" color="base.content.medium">
            {value}
          </Text>
        )}
      </Badge>
    </TouchableTooltip>
  )
}
