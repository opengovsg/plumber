import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import mastheadCrest from '../../assets/masthead-crest.svg'

export const Masthead = () => {
  return (
    <Box
      sx={{
        maxWidth: '100vw',
        height: '1.5rem',
        minHeight: '1.5rem',
        padding: '0rem 1.2rem',
        textAlign: 'center',
        backgroundColor: 'rgb(238,238,238)',
        color: 'black',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <Box
        component="img"
        src={mastheadCrest}
        alt="cres"
        sx={{
          height: '18px',
          width: '18px',
          marginRight: '0.5rem',
        }}
      />
      <Typography variant="caption" fontSize="12px">
        A Singapore Government Website
      </Typography>
    </Box>
  )
}
