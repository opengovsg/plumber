import MuiCardContent from '@mui/material/CardContent'
import { styled } from '@mui/material/styles'

export const CardContent = styled(MuiCardContent)`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  min-height: 200px;
`
