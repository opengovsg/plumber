import * as React from 'react'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import MuiListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import VariablesList from 'components/VariablesList'
import { type StepWithVariables, type Variable } from 'helpers/variables'

const ListItemText = styled(MuiListItemText)``

interface SuggestionsProps {
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

const SHORT_LIST_LENGTH = 4
const LIST_HEIGHT = 256

export default function Suggestions(props: SuggestionsProps) {
  const { data, onSuggestionClick = () => null } = props
  const [current, setCurrent] = React.useState<number | null>(0)
  const [listLength, setListLength] = React.useState<number>(SHORT_LIST_LENGTH)

  const expandList = () => {
    setListLength(Infinity)
  }

  const collapseList = () => {
    setListLength(SHORT_LIST_LENGTH)
  }

  React.useEffect(() => {
    setListLength(SHORT_LIST_LENGTH)
  }, [current])

  return (
    <Paper elevation={5} sx={{ width: '100%' }}>
      <Typography variant="subtitle2" sx={{ p: 2 }}>
        Variables
      </Typography>
      <List disablePadding>
        {data.map((option, index) => (
          <div key={`primary-suggestion-${option.name}`}>
            <ListItemButton
              divider
              onClick={() =>
                setCurrent((currentIndex) =>
                  currentIndex === index ? null : index,
                )
              }
              sx={{ py: 0.5 }}
            >
              <ListItemText primary={option.name} />
              {!!option.output?.length &&
                (current === index ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>

            <Collapse in={current === index} timeout="auto" unmountOnExit>
              <VariablesList
                variables={(option.output ?? []).slice(0, listLength)}
                onClick={onSuggestionClick}
                listHeight={LIST_HEIGHT}
              />

              {(option.output?.length || 0) > listLength && (
                <Button fullWidth onClick={expandList}>
                  Show all
                </Button>
              )}

              {listLength === Infinity && (
                <Button fullWidth onClick={collapseList}>
                  Show less
                </Button>
              )}
            </Collapse>
          </div>
        ))}
      </List>
    </Paper>
  )
}
