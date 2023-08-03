export function escapeMarkdown(text: string): string {
  return text.replaceAll(/[_*`[]/g, (match) => '\\' + match)
}

interface MarkdownModifier {
  char: string
  index: number
}

export function sanitizeMarkdown(text: string): string {
  const markdownModifierList = ['_', '*', '`']
  let currentModifier: MarkdownModifier | null = null
  let isEscaping = false
  const toEscapeOrUnescape: (MarkdownModifier & { toEscape: boolean })[] = []

  // This function removes all unescapes since current modifier
  // Use this when the current modifier doesnt have a matching closing character
  // to ensure the special chars in between are escaped
  function undoUnescapesSinceCurrentModifier() {
    let j = toEscapeOrUnescape.length - 1
    while (j >= 0 && toEscapeOrUnescape[j].index > currentModifier.index) {
      toEscapeOrUnescape.pop()
      j--
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)

    // Set isEscaping flag to true if the current char is a backslash
    if (char === '\\' && !isEscaping) {
      isEscaping = true
      continue
    }
    if (markdownModifierList.includes(char)) {
      if (!currentModifier) {
        if (!isEscaping) {
          // set current modifier to current character if it is not escaped
          currentModifier = {
            char,
            index: i,
          }
        }
      } else {
        if (currentModifier.char === char) {
          if (isEscaping) {
            // Telegram markdown v1 does not support escaping the same modifier character
            // between modifiers e.g. _hello\_world_ does not work
            // So we treat it as an invalid modifier and a normal character
            // All unescapes so far has to be undone
            undoUnescapesSinceCurrentModifier()
            toEscapeOrUnescape.push({ ...currentModifier, toEscape: true })
          }
          currentModifier = null
        } else {
          // Until we find a matching closing character, we remove all unescapes since they will
          // be escaped by telegram e.g. *hello_world* -> <b>hello_world</b>
          if (isEscaping) {
            toEscapeOrUnescape.push({ char, index: i, toEscape: false })
          } else {
            // If the current character is not escaped, we set it as the current modifier
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
    undoUnescapesSinceCurrentModifier()
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
