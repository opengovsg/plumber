import * as React from 'react'
import type { As } from '@chakra-ui/react'
import { useMediaQuery, useTheme } from '@chakra-ui/react'
import {
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
} from '@opengovsg/design-system-react'

type ConditionalIconButtonProps = {
  icon?: IconButtonProps['icon']
  component?: As
} & (ButtonProps | IconButtonProps)

export default function ConditionalIconButton(
  props: ConditionalIconButtonProps,
): React.ReactElement {
  const { icon, component, children, ...buttonProps } = props
  const theme = useTheme()
  const [matchSmallScreens] = useMediaQuery(
    `(max-width: ${theme.breakpoints['md']})`,
    {
      ssr: false,
    },
  )

  // FIXME (ogp-weeloong): We have some Y padding so that it doesn't look _too_
  // weird next to MUI components. Will remove when we move off MUI.

  if (matchSmallScreens) {
    return (
      <IconButton
        py={6}
        icon={icon}
        color={buttonProps.color}
        type={buttonProps.type}
        size={buttonProps.size}
        as={component}
        aria-label={String(children)}
      />
    )
  }

  return (
    <Button py={7} as={component} {...(buttonProps as ButtonProps)}>
      {children}
    </Button>
  )
}
