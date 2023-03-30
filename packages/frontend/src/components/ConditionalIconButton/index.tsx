import * as React from 'react'
import type { ButtonProps } from '@mui/material/Button'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { IconButton } from './style'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function ConditionalIconButton(props: any): React.ReactElement {
  const { icon, ...buttonProps } = props
  const theme = useTheme()
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  })

  if (matchSmallScreens) {
    return (
      <IconButton
        color={buttonProps.color}
        type={buttonProps.type}
        size={buttonProps.size}
        component={buttonProps.component}
      >
        {icon}
      </IconButton>
    )
  }

  return <Button {...(buttonProps as ButtonProps)} />
}
