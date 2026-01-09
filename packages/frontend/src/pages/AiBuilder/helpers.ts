export const getPromptFromFormInput = (formInput: {
  trigger: string
  actions: string
}) => {
  return `#### Start the workflow\n${formInput.trigger}\n\n#### Actions\n${formInput.actions}`
}
