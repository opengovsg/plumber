import MuiAlert, { alertClasses } from '@mui/material/Alert'
import { styled } from '@mui/material/styles'

export const Alert = styled(MuiAlert)(() => ({
  [`&.${alertClasses.root}`]: {
    fontWeight: 300,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  [`& .${alertClasses.message}`]: {
    width: '100%',
  },
}))

export const MessageWrapper = styled('div')`
  margin: 1rem auto;
`
