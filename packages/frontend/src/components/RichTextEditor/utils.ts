export function substituteOldTemplates(original: string): string {
  const searchRegex = /({{[^{}]+}})(?!<\/span>)/
  const nodes = original.split(searchRegex)
  for (const i in nodes) {
    if (!searchRegex.test(nodes[i])) {
      continue
    }
    const id = nodes[i].replace('{{', '').replace('}}', '')
    const idComponents = id.split('.')
    const label = idComponents[idComponents.length - 1]
    nodes[
      i
    ] = `<span data-type="variable" data-id="${id}" data-label="${label}" data-value="">${nodes[i]}</span>`
  }
  return nodes.join('')
}
