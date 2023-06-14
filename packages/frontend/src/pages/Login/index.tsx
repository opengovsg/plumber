import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import mainLogo from 'assets/logo.svg'
import landingImg from 'assets/plumber-landing.svg'
import Container from 'components/Container'
import LoginForm from 'components/LoginForm'
import * as URLS from 'config/urls'

export default function Login(): React.ReactElement {
  const theme = useTheme()
  const navigate = useNavigate()

  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  })

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        alignItems: 'stretch',
        flexDirection: matchSmallScreens ? 'column' : 'row',
      }}
    >
      <Box
        flex={1}
        maxWidth="700px"
        display={matchSmallScreens ? 'none' : 'flex'}
        color="white"
        sx={{ backgroundColor: 'primary.light' }}
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Typography
          variant="h2"
          component="h3"
          color="primary.main"
          marginX={10}
          marginBottom={5}
        >
          Build and automate your work<i>flows</i>
        </Typography>
        <Box
          component="img"
          src={landingImg}
          width="100%"
          left="0"
          paddingRight={10}
        />
      </Box>
      <Box
        flex={matchSmallScreens ? 2 : 1}
        width="100%"
        paddingTop={matchSmallScreens ? '5vh' : 0}
        sx={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Container maxWidth="sm">
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems={matchSmallScreens ? 'center' : 'start'}
          >
            {matchSmallScreens && (
              <Box component="img" src={landingImg} width="35vw" mb={3} />
            )}
            <Typography
              variant={'h2'}
              fontSize={'1.5rem'}
              noWrap
              fontWeight="bold"
              fontFamily={'Space Grotesk'}
              marginBottom={3}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => navigate(URLS.ROOT)}
            >
              <Box component="img" src={mainLogo} height="100%" mr={1} />
              <FormattedMessage id="brandText" />
            </Typography>
          </Box>
          <LoginForm />
        </Container>
      </Box>
    </Box>
  )
}
