import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Stack, Typography, useMediaQuery } from '@mui/material';
import Container from 'components/Container';
import LoginForm from 'components/LoginForm';
import WaterIcon from '@mui/icons-material/Water';

import mario from 'assets/plumber.png';

export default function Login(): React.ReactElement {
  const theme = useTheme();

  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        flexDirection: matchSmallScreens ? 'column' : 'row',
        minHeight: '100vh',
      }}
    >
      <Box
        flex={1}
        display={matchSmallScreens ? 'none' : 'flex'}
        color="white"
        sx={{ backgroundColor: 'primary.main' }}
        height="100%"
        alignItems="center"
        justifyContent="center"
      >
        <Stack width="500px" maxWidth="70%" spacing={5} alignItems="center">
          <Typography variant="h1" component="h2">
            Automate your pipelines
          </Typography>
          <Box
            component="img"
            src={mario}
            width="100%"
            maxWidth={matchSmallScreens ? '20vw' : '250px'}
          />
        </Stack>
      </Box>
      <Box
        flex={matchSmallScreens ? 2 : 1}
        width="100%"
        paddingTop={matchSmallScreens ? '5vh' : 0}
      >
        <Container maxWidth="sm">
          <Typography
            variant="h3"
            component="h3"
            color="primary"
            mb={3}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <WaterIcon sx={{ marginRight: '5px' }} /> Plumber
          </Typography>
          <LoginForm />
        </Container>
      </Box>
    </Box>
  );
}
