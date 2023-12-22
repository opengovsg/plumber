import type { ComponentType } from 'react'
import List from '@mui/material/List'
import ListItem, { ListItemProps } from '@mui/material/ListItem'
import ListItemButton, {
  ListItemButtonProps,
} from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import { type Variable } from 'helpers/variables'

function makeListItemComponent(
  variable: Variable,
  onClick?: (variable: Variable) => void,
): ComponentType<ListItemButtonProps> | ComponentType<ListItemProps> {
  if (onClick) {
    return (props: ListItemButtonProps) => (
      <ListItemButton
        {...props}
        // onClick doesn't work sometimes due to latency between mousedown and immediate mouseup event after
        onMouseDown={() => {
          onClick(variable)
        }}
      />
    )
  }

  return (props: ListItemProps) => <ListItem {...props} />
}

interface VariablesListProps {
  variables: Variable[]
  onClick?: (variable: Variable) => void
  listHeight?: number
}

export default function VariablesList(props: VariablesListProps) {
  const { variables, onClick, listHeight } = props

  if (!variables || variables.length === 0) {
    return <></>
  }

  return (
    <List
      disablePadding
      data-test="power-input-suggestion-group"
      sx={{ maxHeight: listHeight, overflowY: 'auto' }}
    >
      {variables.map((variable) => {
        const ListItemComponent = makeListItemComponent(variable, onClick)
        return (
          <ListItemComponent
            sx={{ pl: 4 }}
            divider
            data-test="power-input-suggestion-item"
            key={`suggestion-${variable.name}`}
          >
            <ListItemText
              primary={variable.label ?? variable.name}
              primaryTypographyProps={{
                variant: 'subtitle1',
                title: 'Property name',
                sx: { fontWeight: 700 },
              }}
              secondary={
                <>
                  {variable.displayedValue ?? variable.value?.toString() ?? ''}
                </>
              }
              secondaryTypographyProps={{
                variant: 'subtitle2',
                title: 'Sample value',
              }}
            />
          </ListItemComponent>
        )
      })}
    </List>
  )
}
