import MuiBox from '@mui/material/Box'
import { inputClasses } from '@mui/material/Input'
import { styled } from '@mui/material/styles'
import MuiTextField from '@mui/material/TextField'

type BoxProps = {
  editing?: boolean
}

const boxShouldForwardProp = (prop: string) => !['editing'].includes(prop)
export const Box = styled(MuiBox, {
  shouldForwardProp: boxShouldForwardProp,
})<BoxProps>`
  display: flex;
  flex: 1;
  width: 300px;
  height: 33px;
  align-items: center;
  ${({ editing }) => editing && `border-bottom: 1px solid #e9eaee;`}
`

export const TextField = styled(MuiTextField)({
  width: '100%',
  [`.${inputClasses.root}:before, .${inputClasses.root}:after, .${inputClasses.root}:hover`]:
    {
      borderBottom: '0 !important',
    },
})
