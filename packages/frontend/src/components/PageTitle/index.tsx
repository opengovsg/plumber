import { memo } from 'react'
import { Flex, Grid, GridItem, Text } from '@chakra-ui/react'

interface PageTitleProps {
  title: string
  searchComponent?: React.ReactNode
  createComponent?: React.ReactNode
}

const PageTitle = ({
  title,
  searchComponent,
  createComponent,
}: PageTitleProps): React.ReactElement => {
  return (
    <Grid
      templateAreas={{
        base: `
              "title button"
              "search search"
            `,
        md: `"title search button"`,
      }}
      gridTemplateColumns={{ base: '1fr auto', md: '2fr 1fr auto' }}
      columnGap={3}
      rowGap={5}
      alignItems="center"
      pl={{ base: 2, md: 8 }}
      mb={6}
      minH={12}
    >
      <GridItem area="title">
        <Flex alignItems="center">
          <Text textStyle="h4">{title}</Text>
        </Flex>
      </GridItem>

      <GridItem area="search">{searchComponent}</GridItem>

      <GridItem area="button">{createComponent}</GridItem>
    </Grid>
  )
}

export default memo(PageTitle)
