import { useEffect, useState } from 'react'
import { ExpandLess, ExpandMore } from '@mui/icons-material'
import {
  Button,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
} from '@mui/material'
import VariablesList from 'components/VariablesList'
import { StepWithVariables, Variable } from 'helpers/variables'

interface SuggestionsProps {
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

const SHORT_LIST_LENGTH = 4
const LIST_HEIGHT = 256

export default function Suggestions(props: SuggestionsProps) {
  const { data, onSuggestionClick = () => null } = props
  const [current, setCurrent] = useState<number | null>(0)
  const [listLength, setListLength] = useState<number>(SHORT_LIST_LENGTH)

  const expandList = () => {
    setListLength(Infinity)
  }

  const collapseList = () => {
    setListLength(SHORT_LIST_LENGTH)
  }

  useEffect(() => {
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

interface SuggestionsPopperProps {
  open: boolean
  anchorEl: HTMLDivElement | null
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

export const SuggestionsPopper = (props: SuggestionsPopperProps) => {
  const { open, anchorEl, data, onSuggestionClick } = props

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      // Allow (ugly) scrolling in nested modals for small viewports; modals
      // can't account for popper overflow if it is portalled to body.
      disablePortal
      style={{
        width: anchorEl?.clientWidth,
        // FIXME (ogp-weeloong): HACKY, temporary workaround. Needed to render
        // sugestions within nested editors, since Chakra renders modals at 40
        // z-index. Will migrate to chakra Popover in separate PR if team is
        // agreeable to flip change.
        zIndex: 40,
      }}
      modifiers={[
        {
          name: 'flip',
          enabled: true,
        },
      ]}
    >
      <Suggestions data={data} onSuggestionClick={onSuggestionClick} />
    </Popper>
  )
}
