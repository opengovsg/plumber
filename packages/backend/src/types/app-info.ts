import AuthenticationStepType from './authentication-step'
import FieldType from './field'

type AppInfo = {
  name: string
  key: string
  iconUrl: string
  docUrl: string
  primaryColor: string
  fields: FieldType[]
  authenticationSteps?: AuthenticationStepType[]
}

export default AppInfo
