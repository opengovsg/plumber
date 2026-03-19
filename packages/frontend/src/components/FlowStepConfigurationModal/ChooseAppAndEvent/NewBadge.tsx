import { Badge } from '@opengovsg/design-system-react'

const VARIANTS = {
  primary: {
    bgColor: 'interaction.muted.main.active',
    color: 'primary.500',
  },
  secondary: {
    bgColor: 'secondary.50',
    color: 'secondary.700',
  },
}

interface NewBadgeProps {
  variant?: keyof typeof VARIANTS
}

export default function NewBadge(props: NewBadgeProps) {
  const { variant = 'primary' } = props

  const { bgColor, color } = VARIANTS[variant]

  return (
    <Badge bgColor={bgColor} color={color}>
      New
    </Badge>
  )
}
