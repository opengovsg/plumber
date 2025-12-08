import { Controller, useFormContext } from 'react-hook-form'
import { Flex, FormLabel, Textarea } from '@chakra-ui/react'

import { SingleSelect } from '@/components/SingleSelect'

interface FeedbackFormData {
  'feedback-dropdown'?: string
  'feedback-details': string
}

const FeedbackFormContent = ({
  dropdownLabel,
  dropdownOptions,
  textAreaLabel,
  textAreaPlaceholder,
  autoFocus,
}: {
  dropdownLabel: string | null
  dropdownOptions: string[] | null
  textAreaLabel: string
  textAreaPlaceholder: string
  autoFocus?: boolean
}) => {
  const { control, register } = useFormContext<FeedbackFormData>()

  return (
    <Flex direction="column">
      {dropdownLabel != null && dropdownOptions != null && (
        <>
          <FormLabel htmlFor="feedback-dropdown" mt={2}>
            {dropdownLabel}
          </FormLabel>
          <Controller
            name="feedback-dropdown"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <SingleSelect
                colorScheme="secondary"
                name="feedback-dropdown"
                items={dropdownOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
                isClearable={false}
              />
            )}
          />
        </>
      )}
      <FormLabel htmlFor="feedback-details" mt={2}>
        {textAreaLabel}
      </FormLabel>
      <Textarea
        id="feedback-details"
        rows={3}
        resize="none"
        autoFocus={autoFocus}
        placeholder={textAreaPlaceholder}
        {...register('feedback-details')}
      />
    </Flex>
  )
}

export default FeedbackFormContent
