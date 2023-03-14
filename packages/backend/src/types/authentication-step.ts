import type { IAuthenticationStepField } from '@plumber/types'

type AuthenticationStep = {
  step: number
  type: string
  name: string
  fields: IAuthenticationStepField[]
}

export default AuthenticationStep
