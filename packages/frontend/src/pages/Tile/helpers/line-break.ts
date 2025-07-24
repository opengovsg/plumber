export function addLineBreak(element: HTMLTextAreaElement) {
  const start = element.selectionStart
  const end = element.selectionEnd
  const value = element.value

  element.value = value.substring(0, start) + '\n' + value.substring(end)
  element.selectionStart = element.selectionEnd = start + 1
}
