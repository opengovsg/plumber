import { Badge } from '@opengovsg/design-system-react'

const COMPACT_STYLES = {
  h: 5,
  py: 0,
  px: 1.5,
  alignItems: 'center',
  fontSize: '0.625rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
}

interface NewBadgeProps {
  isCompact?: boolean
}

export default function NewBadge(props: NewBadgeProps) {
  const { isCompact = false } = props

  return (
    <Badge
      bgColor="interaction.muted.main.active"
      color="primary.500"
      {...(isCompact && COMPACT_STYLES)}
    >
      {isCompact ? 'NEW' : 'New'}
    </Badge>
  )
}
