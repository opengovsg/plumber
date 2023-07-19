import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl } from '@chakra-ui/react'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MuiTextField, {
  TextFieldProps as MuiTextFieldProps,
} from '@mui/material/TextField'
import { FormLabel } from '@opengovsg/design-system-react'
import copyInputValue from 'helpers/copyInputValue'

type TextFieldProps = {
  shouldUnregister?: boolean
  name: string
  clickToCopy?: boolean
  readOnly?: boolean
  description?: string
} & MuiTextFieldProps

const createCopyAdornment = (
  ref: React.RefObject<HTMLInputElement | null>,
): React.ReactElement => {
  return (
    <InputAdornment position="end">
      <IconButton
        onClick={() => copyInputValue(ref.current as HTMLInputElement)}
        edge="end"
      >
        <ContentCopyIcon color="primary" />
      </IconButton>
    </InputAdornment>
  )
}

export default function TextField(props: TextFieldProps): React.ReactElement {
  const { control } = useFormContext()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const {
    required,
    name,
    label,
    description,
    defaultValue,
    shouldUnregister,
    clickToCopy,
    readOnly,
    onBlur,
    onChange,
    ...textFieldProps
  } = props

  return (
    <Controller
      rules={{ required }}
      name={name}
      defaultValue={defaultValue || ''}
      control={control}
      shouldUnregister={shouldUnregister}
      render={({
        field: {
          ref,
          onChange: controllerOnChange,
          onBlur: controllerOnBlur,
          ...field
        },
      }) => (
        <FormControl>
          {label && (
            <FormLabel isRequired={required} description={description}>
              {label}
            </FormLabel>
          )}
          <MuiTextField
            {...textFieldProps}
            {...field}
            onChange={(...args) => {
              controllerOnChange(...args)
              onChange?.(...args)
            }}
            onBlur={(...args) => {
              controllerOnBlur()
              onBlur?.(...args)
            }}
            inputRef={(element) => {
              inputRef.current = element
              ref(element)
            }}
            InputProps={{
              readOnly,
              endAdornment: clickToCopy ? createCopyAdornment(inputRef) : null,
            }}
          />
        </FormControl>
      )}
    />
  )
}

TextField.defaultProps = {
  readOnly: false,
  disabled: false,
  clickToCopy: false,
  shouldUnregister: false,
}
