// Taken from https://github.com/mainarthur/telegram-escape
export function escapeMarkdown(text: string): string {
  const markdownV1EscapeList = ['_', '*', '`', '[']
  return markdownV1EscapeList.reduce(
    (oldText, charToEscape) =>
      oldText.replaceAll(charToEscape, `\\${charToEscape}`),
    text,
  )
}

export function sanitizeMarkdown(text: string): string {
  const markdownModifierList = ['_', '*', '`']
  let currentModifier = null
  let isEscaping = false
  const toEscapeOrUnescape = []
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)

    if (char === '\\' && !isEscaping) {
      isEscaping = true
      continue
    }
    if (markdownModifierList.includes(char)) {
      if (!currentModifier) {
        currentModifier = {
          char,
          index: i,
        }
      } else {
        if (currentModifier.char === char) {
          if (isEscaping) {
            let j = toEscapeOrUnescape.length - 1
            while (
              j >= 0 &&
              toEscapeOrUnescape[j].index > currentModifier.index
            ) {
              toEscapeOrUnescape.pop()
              j--
            }
            toEscapeOrUnescape.push({ ...currentModifier, toEscape: true })
          }
          currentModifier = null
        } else {
          if (isEscaping) {
            toEscapeOrUnescape.push({ char, index: i, toEscape: false })
          } else {
            toEscapeOrUnescape.push({ ...currentModifier, toEscape: true })
            currentModifier = {
              char,
              index: i,
            }
          }
        }
      }
    }

    if (isEscaping) {
      isEscaping = false
    }
  }
  if (currentModifier) {
    toEscapeOrUnescape.push({ ...currentModifier, toEscape: true })
  }
  toEscapeOrUnescape.reverse()
  for (const modifier of toEscapeOrUnescape) {
    if (modifier.toEscape) {
      text =
        text.substring(0, modifier.index) +
        '\\' +
        text.substring(modifier.index)
    } else {
      text =
        text.substring(0, modifier.index - 1) + text.substring(modifier.index)
    }
  }
  return text
}
