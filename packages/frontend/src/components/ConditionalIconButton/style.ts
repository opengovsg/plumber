import MuiIconButton, { iconButtonClasses } from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'

export const IconButton = styled(MuiIconButton)`
  &.${iconButtonClasses.colorPrimary} {
    background: ${({ theme }) => theme.palette.primary.main};
    color: ${({ theme }) => theme.palette.primary.contrastText};

    &:hover {
      background: ${({ theme }) => theme.palette.primary.dark};
    }
  }
` as typeof MuiIconButton
