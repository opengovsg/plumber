import { FieldValues, UseFormGetValues } from 'react-hook-form'
import { PlacementWithLogical } from '@chakra-ui/react'
import { Editor } from '@tiptap/react'
import escapeHtml from 'escape-html'
import {
  HTMLElement as NodeHTMLElement,
  Node,
  parse,
  TextNode,
} from 'node-html-parser'

import { hexDecode } from '@/helpers/hex-encoding'
import type { StepWithVariables, TableVariable } from '@/helpers/variables'

interface TableVariablePreviewData {
  columns: Array<{ id: string; name: string }>
  // All rows, so the preview matches the full table the email sends — not the
  // truncated `sampleRows` used by the in-editor pill.
  rows: Array<Record<string, unknown>>
}

export interface VariableInfo {
  label: string
  testRunValue: string
  /**
   * Present only for table-type variables. Carries the structured data
   * needed to render an HTML table in the email preview (see
   * `substituteForPreview`), mirroring the backend's table rendering.
   */
  table?: TableVariablePreviewData
}

export type VariableInfoMap = Map<string, VariableInfo>

// Builds a VariableInfoMap from the bare-path-keyed (`step.<id>.<path>`,
// no braces) label/value maps used outside the live editor, e.g. AI
// Builder's read-only step preview. No table support: callers needing
// table-variable rendering should use genVariableInfoMap instead.
export function buildVariableInfoMapFromPaths(
  labelsByPath: Map<string, string>,
  valuesByPath: Map<string, string>,
): VariableInfoMap {
  const map: VariableInfoMap = new Map()
  for (const [path, value] of valuesByPath) {
    // Fall back to the last path segment, not the full `step.<id>.<path>`
    // string, which is what a variable chip would otherwise display.
    const lastSegment = path.split('.').pop() ?? path
    map.set(`{{${path}}}`, {
      label: labelsByPath.get(path) ?? lastSegment,
      testRunValue: value,
    })
  }
  return map
}

const HEX_MODIFIER_PATTERN = '[a-fA-F0-9]+'

// Matches step variables with optional hex-encoded modifier
// Format: {{step.uuid.path}} or {{step.uuid.path|hexModifier}}
const VARIABLE_REGEX = new RegExp(
  `({{step\\.[\\da-f]{8}-(?:[\\da-f]{4}-){3}[\\da-f]{12}(?:\\.[\\da-zA-Z-_ ]+)+(?:\\|${HEX_MODIFIER_PATTERN})?}})`,
)
export const GLOBAL_VARIABLE_REGEX = new RegExp(VARIABLE_REGEX, 'g')
/**
 * Used to generate substituted string for hyperlink checking
 */
export function simpleSubstitute(
  original: string,
  varInfo: VariableInfoMap,
): string {
  return original.replaceAll(GLOBAL_VARIABLE_REGEX, (match) => {
    const id = match.replace('{{', '').replace('}}', '')
    // Table variables (id ends with a `|hexModifier`) resolve to the rendered
    // HTML table, mirroring the backend's computeParameters. This keeps the
    // substituted body in sync with the test execution's dataIn so the step's
    // "set up successfully" check (matchParamsToDataIn) matches.
    const tableHtml = renderTableVariableHtml(id, varInfo)
    if (tableHtml != null) {
      return tableHtml
    }
    const varInfoForNode = varInfo.get(`{{${id}}}`)
    return varInfoForNode?.testRunValue || ''
  })
}

/**
 * Extracts every row's data from a table variable for the email preview.
 *
 * `tableVar.value` is the full table JSON (`{ columns, rows }`) the editor
 * stores (set via `JSON.stringify` in helpers/variables.ts), so we parse it to
 * get all rows — unlike the truncated `sampleRows` the in-editor pill uses. The
 * value is always valid JSON from that single producer, so no parse guard is
 * needed; a malformed value should surface loudly rather than silently degrade.
 */
function extractAllTableRows(
  tableVar: TableVariable,
): Array<Record<string, unknown>> {
  const parsed = JSON.parse(tableVar.value as string) as {
    rows?: Array<{ data?: Record<string, unknown> }>
  }
  return (parsed.rows ?? []).map((row) => row?.data ?? {})
}

export function genVariableInfoMap(
  stepsWithVariables: StepWithVariables[],
): VariableInfoMap {
  const result: VariableInfoMap = new Map()

  for (const [stepPosition, step] of stepsWithVariables.entries()) {
    for (const variable of step.output) {
      const placeholderString = `{{${variable.name}}}`
      const label =
        variable.label ??
        variable.name.replace(`step.${step.id}.`, `step${stepPosition + 1}.`)
      const testRunValue = variable.displayedValue ?? String(variable.value)
      const entry: VariableInfo = {
        label,
        testRunValue,
      }
      if (variable.type === 'table') {
        const tableVar = variable as TableVariable
        entry.table = {
          columns: tableVar.columns,
          rows: extractAllTableRows(tableVar),
        }
      }
      result.set(placeholderString, entry)
    }
  }
  return result
}

/**
 * Note: template variable will not require varInfo since value should be empty.
 * Template variable should take the same format as a step variable
 * but using a fake step id defined in VariableBadge.tsx file
 *
 * DO NOT TRY to construct TableVariable div differently because the TableVariable id always changes when different columns are selected.
 * Instead, derive the values from the actual TableVariable in the TableVariablePill.tsx
 */
function constructVariableElement(
  varInfo: VariableInfoMap,
  id: string,
): NodeHTMLElement {
  const idComponents = id.split('.')
  const varInfoForNode = varInfo.get(`{{${id}}}`)
  const value = varInfoForNode?.testRunValue || ''
  const label = varInfoForNode?.label || idComponents[idComponents.length - 1]
  // Check if this is a table variable (has hex modifier)
  const isTableVariable = new RegExp(`\\|${HEX_MODIFIER_PATTERN}$`).test(id)

  const el = new NodeHTMLElement(isTableVariable ? 'div' : 'span', {})
  el.setAttribute('data-type', isTableVariable ? 'tableVariable' : 'variable')
  el.setAttribute('data-id', id)
  el.setAttribute('data-label', label)
  el.setAttribute('data-value', value)
  el.set_content(`{{${id}}}`)
  return el
}

function substituteTemplateStringWithSpan(
  s: string,
  varInfo: VariableInfoMap,
): Node[] {
  const substrings = s.split(VARIABLE_REGEX)
  const nodes: Node[] = []
  for (const substring of substrings) {
    if (!VARIABLE_REGEX.test(substring)) {
      nodes.push(new TextNode(substring))
      continue
    }
    const id = substring.replace('{{', '').replace('}}', '')
    const variableElement = constructVariableElement(varInfo, id)
    nodes.push(variableElement)
  }

  return nodes
}

function recursiveSubstitute(
  el: NodeHTMLElement,
  varInfo: VariableInfoMap,
): NodeHTMLElement {
  const dataIdAttr = el.getAttribute('data-id')
  const dataTypeAttr = el.getAttribute('data-type')
  if (
    (dataTypeAttr === 'variable' || dataTypeAttr === 'tableVariable') &&
    dataIdAttr != null
  ) {
    // if node is already a variable element,
    // we should reconstruct a new element with the latest data
    return constructVariableElement(varInfo, dataIdAttr)
  }
  const newChildNodes: Node[] = []
  el.childNodes.forEach((n) => {
    if (n instanceof NodeHTMLElement) {
      newChildNodes.push(recursiveSubstitute(n, varInfo))
    } else if (n instanceof TextNode) {
      // We cannot use n.textContent here because it will unescape all HTML tags
      newChildNodes.push(
        ...substituteTemplateStringWithSpan(n.rawText, varInfo),
      )
    } else {
      newChildNodes.push(n)
    }
  })
  el.childNodes = newChildNodes
  return el
}

export function substituteOldTemplates(
  original: string,
  varInfo: VariableInfoMap,
): string {
  if (!original) {
    return ''
  }
  const originalElem = parse(original)
  const substitutedDom = recursiveSubstitute(originalElem, varInfo)
  return substitutedDom.outerHTML
}

// Matches a trailing `|<hexModifier>` suffix, capturing the hex in group 1.
// Reused for both `.match` (read the modifier) and `.replace` (strip it).
const HEX_MODIFIER_SUFFIX_REGEX = new RegExp(`\\|(${HEX_MODIFIER_PATTERN})$`)

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Builds an email-safe HTML table string from the resolved table data. Cell
 * content is escaped to prevent HTML injection.
 *
 * The markup/styles mirror the backend's email table renderer (formatAsHtml in
 * packages/backend/src/helpers/format-table-variable.ts) so the preview matches
 * the table that actually gets sent — keep the two in sync.
 */
function buildTableHtml(
  columns: Array<{ id: string; name: string }>,
  rows: Array<Record<string, unknown>>,
): string {
  const headerBg = '#F3F4F6' // gray.100
  const rowOddBg = '#FFFFFF' // white
  const rowEvenBg = '#F9FAFB' // gray.50
  const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'

  const headerCells = columns
    .map(
      (col) =>
        `<td style="${cell} background-color: ${headerBg}; font-weight: 600;"><p style="margin: 0;">${escapeHtml(
          col.name,
        )}</p></td>`,
    )
    .join('')

  const dataRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? rowOddBg : rowEvenBg
      const cells = columns
        .map(
          (col) =>
            `<td style="${cell} background-color: ${bg};"><p style="margin: 0;">${escapeHtml(
              cellToString(row[col.id]),
            )}</p></td>`,
        )
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<table style="border-collapse: collapse;"><tbody><tr>${headerCells}</tr>${dataRows}</tbody></table>`
}

/**
 * Renders a table-variable node's `data-id` (e.g. `step.uuid.path|hexModifier`)
 * into an HTML table string, or returns null when it can't be rendered (no table
 * data in varInfo, malformed modifier, or no valid selected columns).
 */
function renderTableVariableHtml(
  dataId: string,
  varInfo: VariableInfoMap,
): string | null {
  const modifierMatch = dataId.match(HEX_MODIFIER_SUFFIX_REGEX)
  if (!modifierMatch) {
    return null
  }
  const basePath = dataId.replace(HEX_MODIFIER_SUFFIX_REGEX, '')
  const tableData = varInfo.get(`{{${basePath}}}`)?.table
  if (!tableData) {
    return null
  }

  let decodedModifier: string
  try {
    decodedModifier = hexDecode(modifierMatch[1])
  } catch {
    return null
  }
  if (!decodedModifier.startsWith('table:')) {
    return null
  }
  const selectedColumnIds = decodedModifier
    .slice('table:'.length)
    .split(',')
    .filter(Boolean)

  const columnById = new Map(tableData.columns.map((col) => [col.id, col]))
  const selectedColumns = selectedColumnIds
    .map((id) => columnById.get(id))
    .filter((col): col is { id: string; name: string } => col != null)
  if (selectedColumns.length === 0) {
    return null
  }

  return buildTableHtml(selectedColumns, tableData.rows)
}

/**
 * Renders RichTextEditor HTML to plain final-form HTML, suitable for feeding
 * into an email preview pipeline.
 *
 * - Variable spans are replaced with their resolved value: prefer the entry in
 *   `varInfo`, fall back to the node's own `data-value` attribute (kept current
 *   by `recursiveSubstitute`).
 * - Table-variable nodes are rendered as an HTML table from the resolved table
 *   data in `varInfo` (mirroring the email), falling back to the resolved text
 *   value if the table can't be rendered.
 * - Legacy `{{step.…}}` patterns remaining in plain text nodes are resolved
 *   via `simpleSubstitute`.
 */
export function substituteForPreview(
  html: string,
  varInfo: VariableInfoMap,
): string {
  if (!html) {
    return ''
  }

  const root = parse(html)

  function processChildren(parent: NodeHTMLElement): void {
    const newChildren: Node[] = []
    for (const child of parent.childNodes) {
      if (child instanceof NodeHTMLElement) {
        const dataType = child.getAttribute('data-type')
        const dataId = child.getAttribute('data-id')
        if (dataType === 'tableVariable' && dataId != null) {
          const tableHtml = renderTableVariableHtml(dataId, varInfo)
          if (tableHtml != null) {
            newChildren.push(...parse(tableHtml).childNodes)
            continue
          }
          // Couldn't render a table: fall back to the resolved text value.
          const basePath = dataId.replace(HEX_MODIFIER_SUFFIX_REGEX, '')
          const fromMap = varInfo.get(`{{${basePath}}}`)?.testRunValue
          const fallback = child.getAttribute('data-value') ?? ''
          newChildren.push(new TextNode(fromMap ?? fallback))
          continue
        }
        if (dataType === 'variable' && dataId != null) {
          const fromMap = varInfo.get(`{{${dataId}}}`)?.testRunValue
          const fallback = child.getAttribute('data-value') ?? ''
          newChildren.push(new TextNode(fromMap ?? fallback))
          continue
        }
        processChildren(child)
        newChildren.push(child)
      } else if (child instanceof TextNode) {
        newChildren.push(new TextNode(simpleSubstitute(child.rawText, varInfo)))
      } else {
        newChildren.push(child)
      }
    }
    parent.childNodes = newChildren
  }

  processChildren(root)
  return root.outerHTML
}

export function getPopoverPlacement(
  editor: Editor | null,
): PlacementWithLogical {
  if (typeof window === 'undefined' || editor == null) {
    return 'bottom-start'
  }

  const editorElement = editor?.view.dom as HTMLElement
  if (!editorElement) {
    return 'bottom-start'
  }

  const rect = editorElement.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  // If there's more space above than below, show the popover above
  return spaceAbove > spaceBelow ? 'top-start' : 'bottom-start'
}

export const checkAutoFocus = (
  name: string,
  getValues: UseFormGetValues<FieldValues>,
  autoFocusProp?: boolean,
) => {
  const pathParts = name.split('.')
  const fieldParentPath = pathParts.slice(0, -1).join('.')
  const rowData = getValues(fieldParentPath)
  const isNewRow = rowData?.isNew
  return { shouldAutoFocus: isNewRow && autoFocusProp, isNewRow, rowData }
}

// Add scrolling behavior for single-line mode
export const singleLineEditorScroll = (editor: Editor) => {
  if (!editor) {
    return
  }

  const singleLineEditor = editor.view.dom.closest(
    '.single-line-editor',
  ) as HTMLElement
  if (singleLineEditor) {
    // Get the current cursor position
    const pos = editor.state.selection.$head.pos
    let targetVariable = findClosestVariableNode(editor, pos, singleLineEditor)

    // If we still haven't found it, fall back to the last variable
    if (!targetVariable) {
      const variables = Array.from(
        singleLineEditor.getElementsByClassName('node-variable'),
      ) as HTMLElement[]
      if (variables.length > 0) {
        targetVariable = variables[variables.length - 1]
      }
    }

    // Scroll to the target variable if found
    if (targetVariable) {
      scrollVariableIntoView(targetVariable, singleLineEditor)
    }
  }
}

export function findClosestVariableNode(
  editor: any,
  pos: number,
  container: HTMLElement,
): HTMLElement | null {
  for (let offset = -1; offset <= 1; offset++) {
    const checkPos = Math.max(0, pos + offset)
    const domInfo = editor.view.domAtPos(checkPos)
    const node = domInfo.node as HTMLElement

    if (node.classList?.contains('node-variable')) {
      return node
    }

    const prevSibling = node.previousElementSibling as HTMLElement
    if (prevSibling?.classList?.contains('node-variable')) {
      return prevSibling
    }

    const nextSibling = node.nextElementSibling as HTMLElement
    if (nextSibling?.classList?.contains('node-variable')) {
      return nextSibling
    }
  }

  // Fallback: last variable in the container
  const variables = container.getElementsByClassName('node-variable')
  return variables.length > 0
    ? (variables[variables.length - 1] as HTMLElement)
    : null
}

export function scrollVariableIntoView(
  target: HTMLElement,
  container: HTMLElement,
) {
  const targetDiv = target
  const containerWidth = container.clientWidth
  const scrollLeft =
    targetDiv.offsetLeft - containerWidth + targetDiv.offsetWidth + 20
  container.scrollTo({
    left: Math.max(0, scrollLeft),
    behavior: 'smooth',
  })
}

export function removeProblematicWhitespace(text: string): string {
  if (!text) {
    return ''
  }
  return (
    text
      // Remove zero-width spaces
      .replace(/(\u200B|\uFEFF|\u200C|\u200D|\u200E)/g, '')
      // Replace non-breaking space with regular space
      .replace(/\u00A0/g, ' ')
      // Remove null character that breaks DB/JSON
      // eslint-disable-next-line no-control-regex
      .replace(/\x00/g, '')
  )
}
