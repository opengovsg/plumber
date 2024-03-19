import { Grid, GridItem } from '@chakra-ui/react'

import AppIntegration, { AppIntegrationProps } from './AppIntegration'

interface AppGridProps {
  appIntegrations: AppIntegrationProps[]
}

export default function AppGrid(props: AppGridProps) {
  const { appIntegrations } = props
  return (
    <Grid
      templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)' }}
      gap={12}
      w="100%"
    >
      {appIntegrations.map(({ iconName, name, description }) => (
        <GridItem key={name}>
          <AppIntegration
            iconName={iconName}
            name={name}
            description={description}
          ></AppIntegration>
        </GridItem>
      ))}
    </Grid>
  )
}
