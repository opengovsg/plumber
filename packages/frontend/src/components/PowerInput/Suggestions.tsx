import type { IStep } from '@plumber/types'

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

const ListItemText = styled(MuiListItemText)``

type SuggestionsProps = {
  data: any[]
  onSuggestionClick: (variable: any) => void
}

const SHORT_LIST_LENGTH = 4
const LIST_HEIGHT = 256

const getPartialArray = (array: any[], length = array.length) => {
  return array.slice(0, length)
}

const Suggestions = (props: SuggestionsProps) => {
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
        {data.map((option: IStep, index: number) => (
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
              <List
                component="div"
                disablePadding
                sx={{ maxHeight: LIST_HEIGHT, overflowY: 'auto' }}
                data-test="power-input-suggestion-group"
              >
                {getPartialArray((option.output as any) || [], listLength).map(
                  (suboption: any) => (
                    <ListItemButton
                      sx={{ pl: 4 }}
                      divider
                      onClick={() => onSuggestionClick(suboption)}
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
                    </ListItemButton>
                  ),
                )}
              </List>

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

export default Suggestions
