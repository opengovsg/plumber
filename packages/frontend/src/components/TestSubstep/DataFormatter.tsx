import type { IStep } from '@plumber/types'

import { ListItem } from '@mui/material'
import List from '@mui/material/List'
import MuiListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'

const ListItemText = styled(MuiListItemText)``

type DataFormatterProps = {
  data: any[]
}

const LIST_HEIGHT = 512

const getPartialArray = (array: any[], length = array.length) => {
  return array.slice(0, length)
}

const DataFormatter = (props: DataFormatterProps) => {
  const { data } = props
  const trueData: IStep = data[0] // should only have one

  return (
    <Paper elevation={1} sx={{ width: '100%' }}>
      <Typography
        variant="subtitle2"
        sx={{ p: 1, fontSize: '1rem', color: 'black' }}
      >
        Here is your test data:
      </Typography>
      <List
        component="div" // TODO: remove cus of error
        disablePadding
        sx={{ maxHeight: LIST_HEIGHT, overflowY: 'auto' }}
        data-test="power-input-suggestion-group"
      >
        {getPartialArray((trueData.output as any) || [], Infinity).map(
          (suboption: any) => (
            <ListItem
              sx={{ pl: 4 }}
              divider
              data-test="power-input-suggestion-item"
              key={`suggestion-${suboption.name}`}
            >
              <ListItemText
                primary={suboption.label ?? suboption.name}
                primaryTypographyProps={{
                  variant: 'subtitle1',
                  title: 'Property name',
                  sx: { fontWeight: 700 },
                }}
                secondary={
                  <>
                    {suboption.displayedValue ??
                      suboption.value?.toString() ??
                      ''}
                  </>
                }
                secondaryTypographyProps={{
                  variant: 'subtitle2',
                  title: 'Sample value',
                  noWrap: true,
                }}
              />
            </ListItem>
          ),
        )}
      </List>
    </Paper>
  )
}

export default DataFormatter
