import * as React from 'react'
import type { UseFormProps } from 'react-hook-form'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm,
  UseFormReturn,
} from 'react-hook-form'

type FormProps = {
  children?: React.ReactNode
  defaultValues?: UseFormProps['defaultValues']
  onSubmit?: SubmitHandler<FieldValues>
  render?: (props: UseFormReturn) => React.ReactNode
  resolver?: UseFormProps['resolver']
  mode?: UseFormProps['mode']
}

const noop = () => null

export default function Form(props: FormProps): React.ReactElement {
  const {
    children,
    onSubmit = noop,
    defaultValues,
    resolver,
    mode = 'all',
    ...formProps
  } = props

  const form: UseFormReturn = useForm({
    defaultValues,
    reValidateMode: 'onBlur',
    resolver,
    mode,
  })

  React.useEffect(() => {
    form.reset(defaultValues)
    form.trigger()
  }, [defaultValues, form])

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...formProps}>
        {children}
      </form>
    </FormProvider>
  )
}
