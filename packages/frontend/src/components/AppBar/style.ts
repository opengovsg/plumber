import { Link as RouterLink } from 'react-router-dom'
import { styled } from '@mui/material/styles'

export const Link = styled(RouterLink)(() => ({
  textDecoration: 'none',
  color: 'inherit',
  display: 'inline-flex',
}))
