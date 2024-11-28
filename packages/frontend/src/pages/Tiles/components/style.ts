import { FlexProps } from '@chakra-ui/react'

export const flexStyles = {
  container: {
    color: 'base.content.medium',
    direction: {
      base: 'column',
      md: 'row',
    } as FlexProps['direction'],
    textStyle: 'body-2',
  },
  usedInPipes: {
    alignItems: 'center',
    marginLeft: { base: 0, md: '-0.25em' },
  },
}

export const linkStyles = {
  px: 8,
  py: 6,
  w: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
  _hover: {
    bg: 'interaction.muted.neutral.hover',
    '& .hover-remove-button': {
      visibility: 'visible',
    },
  },
  _active: {
    bg: 'interaction.muted.neutral.active',
  },
}

export const pulsingDotStyles = {
  animation: 'pulse 2s infinite',
  fontSize: '3em',
  marginLeft: { base: '-0.4em', md: 0 },
  marginTop: '-0.5em',
  marginBottom: '-0.5em',
  '@keyframes pulse': {
    '0%': { opacity: 0.4 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.4 },
  },
}

export const tagStyles = {
  colorScheme: 'secondary',
  size: 'xs',
  variant: 'subtle',
  py: 2,
  gap: 1,
  pointerEvents: 'none' as const,
}

export const textStyles = {
  lastOpened: {
    width: {
      base: 'full',
      md: '17.5em',
    },
  },
}
