import { ListItem } from '@mui/material'
import List from '@mui/material/List'
import MuiListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { StepWithVariables, Variable } from 'helpers/variables'

const ListItemText = styled(MuiListItemText)``

interface DataFormatterProps {
  data: StepWithVariables
}

const LIST_HEIGHT = 512

export default function DataFormatter(props: DataFormatterProps) {
  const { data } = props
  return (
    <Paper elevation={1} sx={{ width: '100%' }}>
      <Typography
        variant="subtitle2"
        sx={{ p: 1, fontSize: '1rem', color: 'black' }}
      >
        Here is your test data:
      </Typography>
      <List
        disablePadding
        sx={{ maxHeight: LIST_HEIGHT, overflowY: 'auto' }}
        data-test="power-input-suggestion-group"
      >
        {(data.output || []).slice(0, Infinity).map((suboption: Variable) => (
          <ListItem
            sx={{ pl: 2 }}
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
              }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}
