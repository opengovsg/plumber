import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import Container from 'components/Container';
import LoginForm from 'components/LoginForm';

import mario from 'assets/plumber.png';

export default function Login(): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }}>
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
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
          <Box component="img" src={mario} width="100%" maxWidth="250px" />
        </Stack>
      </Box>
      <Box flex={1}>
        <Container maxWidth="sm">
          <LoginForm />
        </Container>
      </Box>
    </Box>
  );
}
