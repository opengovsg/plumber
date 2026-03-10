function parseWorkflow(markdownText: string) {
  const result = {
    trigger: '',
    actions: '',
  }

  // Extract trigger section (everything between "#### Start the workflow" and "#### Actions")
  const triggerMatch = markdownText.match(
    /#### Start the workflow\s+([\s\S]*?)#### Actions/,
  )
  if (triggerMatch) {
    result.trigger = triggerMatch[1].trim()
  }

  // Extract actions section (everything after "#### Actions")
  const actionsMatch = markdownText.match(/#### Actions\s+([\s\S]*)/)
  if (actionsMatch) {
    result.actions = actionsMatch[1].trim()
  }

  return result
}

export { parseWorkflow }
